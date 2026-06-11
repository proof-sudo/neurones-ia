import io
import logging
import os
import platform

import pdfplumber

from config.settings import settings
from core.ports.document_parser import DocumentParser

logger = logging.getLogger(__name__)

# ── Optional deps ──────────────────────────────────────────────────────────────

_FITZ_AVAILABLE = False
try:
    import fitz  # PyMuPDF
    _FITZ_AVAILABLE = True
except ImportError:
    pass

_TESSERACT_AVAILABLE = False
try:
    import pytesseract
    from PIL import Image

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
except ImportError:
    pass


class PDFAdapter(DocumentParser):
    """
    Extraction de texte PDF avec triple fallback :
    1. pdfplumber  — PDFs structurés standard
    2. PyMuPDF     — PDFs complexes / encodage non-standard
    3. OCR (PyMuPDF + pytesseract) — PDFs scannés (images)
    """

    async def parse(self, file_path: str) -> str:
        n_pages = self._page_count(file_path)

        # Étape 1 : pdfplumber
        text = self._try_pdfplumber(file_path)

        # Étape 2 : PyMuPDF (garde le plus riche des deux)
        if _FITZ_AVAILABLE:
            text2 = self._try_pymupdf(file_path)
            if len(text2) > len(text):
                logger.info("PDF : PyMuPDF plus riche que pdfplumber sur %s", file_path)
                text = text2

        # Si la couche texte est suffisante, on s'arrête là (pas d'OCR inutile).
        if text and self._text_layer_ok(text, n_pages):
            return text

        # Étape 3 : OCR — soit aucun texte, soit couche texte anormalement maigre (PDF
        # quasi scanné). On OCR-ise et on garde le résultat s'il est plus riche.
        if _FITZ_AVAILABLE and _TESSERACT_AVAILABLE:
            reason = "aucun texte" if not text else (
                f"couche texte maigre (~{len(text) // max(1, n_pages)} chars/page < "
                f"{settings.ocr_min_chars_per_page})"
            )
            logger.info("Lancement OCR sur %s (%s)…", file_path, reason)
            ocr_text = self._try_ocr(file_path)
            if len(ocr_text) > len(text):
                logger.info("PDF extrait via OCR (%d caractères) : %s", len(ocr_text), file_path)
                return ocr_text

        if not text:
            logger.warning("Aucun texte extrait de %s", file_path)
        return text

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

    def _try_pdfplumber(self, file_path: str) -> str:
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
                    if parts:
                        pages.append("\n\n".join(parts))
            return "\n\n".join(pages)
        except Exception as e:
            logger.debug("pdfplumber échoué sur %s : %s", file_path, e)
            return ""

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

    def _try_pymupdf(self, file_path: str) -> str:
        try:
            import fitz
            pages = []
            with fitz.open(file_path) as doc:
                for page in doc:
                    text = page.get_text("text")
                    if text and text.strip():
                        pages.append(text.strip())
            return "\n\n".join(pages)
        except Exception as e:
            logger.debug("PyMuPDF échoué sur %s : %s", file_path, e)
            return ""

    def _try_ocr(self, file_path: str) -> str:
        """Rendu page → image (200 DPI) puis OCR Tesseract (fra+eng). Max 20 pages."""
        try:
            import fitz
            import pytesseract
            from PIL import Image

            pages_text = []
            with fitz.open(file_path) as doc:
                n = len(doc)
                cap = settings.ocr_max_pages
                max_pages = min(n, cap)  # cap pages pour éviter les timeouts
                if n > cap:
                    logger.warning(
                        "OCR TRONQUÉ : %d pages sur %d traitées (cap=%d) — pages %d→%d non lues "
                        "sur %s. Relever settings.ocr_max_pages si nécessaire.",
                        cap, n, cap, cap + 1, n, file_path,
                    )
                for i in range(max_pages):
                    page = doc[i]
                    logger.debug("OCR page %d/%d…", i + 1, max_pages)
                    # 200 DPI : bon compromis vitesse/qualité (était 300 DPI → trop lent)
                    mat = fitz.Matrix(200 / 72, 200 / 72)
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    img = Image.open(io.BytesIO(pix.tobytes("png")))
                    # Tente français puis anglais en fallback
                    try:
                        text = pytesseract.image_to_string(img, lang="fra+eng")
                    except pytesseract.TesseractError:
                        text = pytesseract.image_to_string(img, lang="eng")
                    if text.strip():
                        pages_text.append(text.strip())

            return "\n\n".join(pages_text)
        except Exception as e:
            logger.warning("OCR échoué sur %s : %s", file_path, e)
            return ""

    def supports(self, file_path: str) -> bool:
        return file_path.lower().endswith(".pdf")
