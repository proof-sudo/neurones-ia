import io
import logging
import os
import platform

import pdfplumber

from config.settings import settings
from core.ports.document_parser import DocumentParser
from adapters.parser.markdown_fidelity import (
    alnum_count as _alnum_count,
    is_faithful as _is_faithful,
    FIDELITY_MIN_RATIO as _FIDELITY_MIN_RATIO,
)

logger = logging.getLogger(__name__)

# ── Optional deps ──────────────────────────────────────────────────────────────

_FITZ_AVAILABLE = False
try:
    import fitz  # PyMuPDF  # noqa: F401 (probe de disponibilité)
    _FITZ_AVAILABLE = True
except ImportError:
    pass

_PYMUPDF4LLM_AVAILABLE = False
try:
    import pymupdf4llm  # PDF → Markdown (titres, tableaux, listes) ; s'appuie sur PyMuPDF  # noqa: F401
    _PYMUPDF4LLM_AVAILABLE = True
except ImportError:
    pass

_TESSERACT_AVAILABLE = False
# Langues OCR réellement disponibles, déterminées après détection du binaire.
# On ne demande jamais une langue absente : Tesseract n'échoue pas toujours sur
# "fra+eng" quand "fra" manque (il retombe silencieusement sur "eng"), donc le
# repli via except ne suffit pas à garantir le bon modèle.
_OCR_LANGS = "eng"
try:
    import pytesseract
    from PIL import Image  # noqa: F401 (probe de disponibilité)

    # Sur Windows, pointer vers le chemin par défaut si pas configuré
    if platform.system() == "Windows":
        _win_path = os.environ.get(
            "TESSERACT_CMD",
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        )
        if os.path.exists(_win_path):
            pytesseract.pytesseract.tesseract_cmd = _win_path
            _TESSERACT_AVAILABLE = True
        else:
            logger.warning(
                "Tesseract introuvable à %s — OCR désactivé. "
                "Téléchargez l'installer sur https://github.com/UB-Mannheim/tesseract/wiki",
                _win_path,
            )
    else:
        _TESSERACT_AVAILABLE = True

    if _TESSERACT_AVAILABLE:
        try:
            _installed_langs = set(pytesseract.get_languages(config=""))
        except Exception as e:  # binaire injoignable, droits, etc.
            logger.debug("Liste des langues Tesseract indisponible : %s", e)
            _installed_langs = set()
        _wanted = [lang for lang in ("fra", "eng") if lang in _installed_langs]
        if _wanted:
            _OCR_LANGS = "+".join(_wanted)
        if _installed_langs and "fra" not in _installed_langs:
            logger.warning(
                "Pack de langue Tesseract 'fra' absent (langues présentes : %s) — "
                "OCR en anglais uniquement, qualité dégradée sur les PDF scannés en "
                "français. Installez fra.traineddata dans le dossier tessdata "
                "(https://github.com/tesseract-ocr/tessdata).",
                ", ".join(sorted(_installed_langs)) or "aucune",
            )
except ImportError:
    pass


class PDFAdapter(DocumentParser):
    """
    Extraction de texte PDF avec cascade :
    0. pymupdf4llm — Markdown structuré (titres, tableaux, listes) ; repli si fidélité < seuil
    1. pdfplumber  — PDFs structurés standard (texte plat)
    2. PyMuPDF     — PDFs complexes / encodage non-standard
    3. OCR (PyMuPDF + pytesseract) — PDFs scannés (images)
    """

    async def parse(self, file_path: str) -> str:
        # Étape 0 : Markdown structuré (pymupdf4llm) — préserve titres, tableaux, listes.
        # Garde-fou : repli sur le pipeline texte/OCR page-par-page si la conversion perd
        # du contenu (les PDF scannés/CV à page-image ne donnent pas un Markdown fidèle).
        if _PYMUPDF4LLM_AVAILABLE:
            markdown = self._try_pymupdf4llm(file_path)
            if markdown:
                baseline = self._plain_text_baseline(file_path)
                if _is_faithful(markdown, baseline):
                    logger.info(
                        "PDF → Markdown via pymupdf4llm (%d caractères) : %s",
                        len(markdown), file_path,
                    )
                    return markdown
                logger.warning(
                    "PDF → Markdown rejeté (fidélité %d/%d car. alphanum. < %.0f %%) — "
                    "repli sur le pipeline texte/OCR : %s",
                    _alnum_count(markdown), _alnum_count(baseline),
                    _FIDELITY_MIN_RATIO * 100, file_path,
                )

        # Décision OCR PAGE PAR PAGE (et non sur la moyenne du document) : un CV peut
        # avoir des pages texte ET une page de certifications/diplômes en image. Une
        # moyenne globale « ok » sauterait l'OCR et perdrait cette page-image noyée dans
        # un document par ailleurs textuel. On OCR-ise donc uniquement les pages maigres.
        plumber_pages = self._pdfplumber_pages(file_path)
        mupdf_pages = self._pymupdf_pages(file_path) if _FITZ_AVAILABLE else []
        n_pages = max(len(plumber_pages), len(mupdf_pages))

        if n_pages == 0:
            logger.warning("Aucune page lisible dans %s", file_path)
            return ""

        # Pages contenant une image significative (scan de certif/diplôme) — un second signal
        # au-delà du simple compte de caractères, pour les pages « titre + image ».
        image_pages = self._image_heavy_pages(file_path) if _FITZ_AVAILABLE else set()

        # Par page : on garde la couche texte la plus riche (pdfplumber vs PyMuPDF).
        pages: list[str] = []
        thin_pages: list[int] = []
        for i in range(n_pages):
            p = plumber_pages[i] if i < len(plumber_pages) else ""
            m = mupdf_pages[i] if i < len(mupdf_pages) else ""
            best = m if len(m) > len(p) else p
            pages.append(best)
            n_chars = len(best.strip())
            # Maigre si : (a) presque pas de texte, ou (b) image significative + texte modéré
            # (cas « Certifications » : un titre/légende noie le seuil mais le contenu est en image).
            if n_chars < settings.ocr_min_chars_per_page or (
                i in image_pages and n_chars < settings.ocr_image_page_text_max
            ):
                thin_pages.append(i)

        # OCR ciblé : seulement les pages à couche texte maigre (scans, certifs en image).
        if thin_pages and _FITZ_AVAILABLE and _TESSERACT_AVAILABLE:
            logger.info(
                "OCR ciblé sur %d/%d page(s) maigre(s) de %s : pages %s",
                len(thin_pages), n_pages, file_path, thin_pages,
            )
            ocr_by_page = self._ocr_pages(file_path, thin_pages)
            for i, otext in ocr_by_page.items():
                if len(otext) > len(pages[i]):
                    logger.info("Page %d de %s récupérée par OCR (%d chars)", i, file_path, len(otext))
                    pages[i] = otext
        elif thin_pages and not (_FITZ_AVAILABLE and _TESSERACT_AVAILABLE):
            logger.warning(
                "%d page(s) maigre(s) dans %s mais OCR indisponible (fitz=%s, tesseract=%s) "
                "— contenu en image non lu.",
                len(thin_pages), file_path, _FITZ_AVAILABLE, _TESSERACT_AVAILABLE,
            )

        result = "\n\n".join(p for p in pages if p.strip())
        if not result:
            logger.warning("Aucun texte extrait de %s", file_path)
        return result

    @staticmethod
    def _page_count(file_path: str) -> int:
        """Nombre de pages (best-effort). Sert au seuil chars/page. 0 si indéterminable."""
        if _FITZ_AVAILABLE:
            try:
                import fitz
                with fitz.open(file_path) as doc:
                    return len(doc)
            except Exception:
                pass
        try:
            with pdfplumber.open(file_path) as pdf:
                return len(pdf.pages)
        except Exception:
            return 0

    @staticmethod
    def _text_layer_ok(text: str, n_pages: int) -> bool:
        """La couche texte est-elle assez fournie, ou faut-il tenter l'OCR ?

        Heuristique : si on a moins de `ocr_min_chars_per_page` caractères par page en
        moyenne, le PDF est probablement scanné avec une couche texte résiduelle (tampons,
        en-têtes) → l'OCR donnera mieux. n_pages inconnu (0) → on fait confiance au texte.
        """
        if n_pages <= 0:
            return bool(text.strip())
        return (len(text) / n_pages) >= settings.ocr_min_chars_per_page

    # ── Extracteurs ────────────────────────────────────────────────────────────

    def _try_pymupdf4llm(self, file_path: str) -> str:
        """Conversion PDF → Markdown (titres #, tableaux |…|, listes). Vide si échec."""
        try:
            import pymupdf4llm
            md = pymupdf4llm.to_markdown(file_path)
            return md.strip() if md else ""
        except Exception as e:
            logger.debug("pymupdf4llm échoué sur %s : %s", file_path, e)
            return ""

    def _plain_text_baseline(self, file_path: str) -> str:
        """Texte plat de référence pour juger la fidélité du Markdown (PyMuPDF puis pdfplumber)."""
        if _FITZ_AVAILABLE:
            text = self._try_pymupdf(file_path)
            if text:
                return text
        return self._try_pdfplumber(file_path)

    @staticmethod
    def _image_heavy_pages(file_path: str) -> set[int]:
        """Indices des pages contenant ≥ 1 image couvrant une fraction significative de la page
        (settings.ocr_image_area_ratio). Sert à repérer les certifs/diplômes scannés posés sur
        une page par ailleurs peu textuelle. Best-effort : toute erreur → page non signalée."""
        heavy: set[int] = set()
        try:
            import fitz
            with fitz.open(file_path) as doc:
                for i, page in enumerate(doc):
                    page_area = abs(page.rect.width * page.rect.height)
                    if page_area <= 0:
                        continue
                    try:
                        infos = page.get_image_info()
                    except Exception:
                        continue
                    for info in infos:
                        bbox = info.get("bbox")
                        if not bbox:
                            continue
                        w, h = (bbox[2] - bbox[0]), (bbox[3] - bbox[1])
                        if (abs(w * h) / page_area) >= settings.ocr_image_area_ratio:
                            heavy.add(i)
                            break
        except Exception as e:
            logger.debug("Détection d'images échouée sur %s : %s", file_path, e)
        return heavy

    def _pdfplumber_pages(self, file_path: str) -> list[str]:
        """Texte par page via pdfplumber (tableaux rendus en Markdown inclus)."""
        try:
            with pdfplumber.open(file_path) as pdf:
                pages = []
                for page in pdf.pages:
                    text = page.extract_text(x_tolerance=3, y_tolerance=3)
                    if not text:
                        words = page.extract_words()
                        if words:
                            text = " ".join(w["text"] for w in words)
                    parts = []
                    if text and text.strip():
                        parts.append(text.strip())
                    # Les grilles de notation, profils et annexes des AO sont en tableaux :
                    # extract_text() les aplatit (colonnes/lignes mélangées). On ré-ajoute
                    # chaque tableau rendu en Markdown pour préserver la structure ligne/colonne.
                    tables_md = self._render_tables(page)
                    if tables_md:
                        parts.append(tables_md)
                    pages.append("\n\n".join(parts))
            return pages
        except Exception as e:
            logger.debug("pdfplumber échoué sur %s : %s", file_path, e)
            return []

    def _try_pdfplumber(self, file_path: str) -> str:
        return "\n\n".join(p for p in self._pdfplumber_pages(file_path) if p.strip())

    @staticmethod
    def _render_tables(page) -> str:
        """Rend les tableaux d'une page en Markdown (| col | col |) pour conserver leur structure.

        Tolérant : toute erreur d'extraction de tableau est ignorée (le texte linéaire reste
        la source principale). Les lignes/cellules vides sont normalisées en chaînes vides.
        """
        try:
            tables = page.extract_tables()
        except Exception:
            return ""
        if not tables:
            return ""
        blocks = []
        for idx, table in enumerate(tables, 1):
            rows = []
            for row in table or []:
                cells = [" ".join((c or "").split()) for c in row]
                if any(cells):
                    rows.append("| " + " | ".join(cells) + " |")
            if rows:
                blocks.append(f"[TABLEAU {idx}]\n" + "\n".join(rows))
        return "\n\n".join(blocks)

    def _pymupdf_pages(self, file_path: str) -> list[str]:
        """Texte par page via PyMuPDF."""
        try:
            import fitz
            pages = []
            with fitz.open(file_path) as doc:
                for page in doc:
                    text = page.get_text("text")
                    pages.append(text.strip() if text else "")
            return pages
        except Exception as e:
            logger.debug("PyMuPDF échoué sur %s : %s", file_path, e)
            return []

    def _try_pymupdf(self, file_path: str) -> str:
        return "\n\n".join(p for p in self._pymupdf_pages(file_path) if p.strip())

    def _ocr_pages(self, file_path: str, page_indices: list[int]) -> dict[int, str]:
        """OCR ciblé : rend chaque page demandée en image (200 DPI) puis Tesseract (fra+eng).
        Retourne {index_page: texte}. Cappé à settings.ocr_max_pages pages OCR-isées.
        Utilise les langues réellement installées (_OCR_LANGS, idéalement fra+eng)."""
        try:
            import fitz
            import pytesseract
            from PIL import Image

            out: dict[int, str] = {}
            with fitz.open(file_path) as doc:
                n = len(doc)
                wanted = [i for i in page_indices if 0 <= i < n]
                cap = settings.ocr_max_pages
                if len(wanted) > cap:
                    logger.warning(
                        "OCR TRONQUÉ : %d pages à OCR-iser sur %s, cap=%d — pages %s non lues. "
                        "Relever settings.ocr_max_pages si nécessaire.",
                        len(wanted), file_path, cap, wanted[cap:],
                    )
                    wanted = wanted[:cap]
                # 200 DPI : bon compromis vitesse/qualité (était 300 DPI → trop lent)
                mat = fitz.Matrix(200 / 72, 200 / 72)
                for i in wanted:
                    logger.debug("OCR page %d de %s…", i, file_path)
                    pix = doc[i].get_pixmap(matrix=mat, alpha=False)
                    img = Image.open(io.BytesIO(pix.tobytes("png")))
                    # Langues installées (fra+eng si dispo) ; repli eng par sécurité
                    try:
                        text = pytesseract.image_to_string(img, lang=_OCR_LANGS)
                    except pytesseract.TesseractError:
                        text = pytesseract.image_to_string(img, lang="eng")
                    if text.strip():
                        out[i] = text.strip()
            return out
        except Exception as e:
            logger.warning("OCR échoué sur %s : %s", file_path, e)
            return {}

    def _try_ocr(self, file_path: str) -> str:
        """OCR de toutes les pages (compat). Préférer _ocr_pages pour l'OCR ciblé."""
        n = self._page_count(file_path)
        if n <= 0:
            return ""
        by_page = self._ocr_pages(file_path, list(range(n)))
        return "\n\n".join(by_page[i] for i in sorted(by_page))

    def supports(self, file_path: str) -> bool:
        return file_path.lower().endswith(".pdf")
