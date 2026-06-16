import io
import logging
import os
import platform

import pdfplumber

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
    import fitz  # PyMuPDF
    _FITZ_AVAILABLE = True
except ImportError:
    pass

_PYMUPDF4LLM_AVAILABLE = False
try:
    import pymupdf4llm  # PDF → Markdown (titres, tableaux, listes) ; s'appuie sur PyMuPDF
    _PYMUPDF4LLM_AVAILABLE = True
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
    Extraction de texte PDF avec cascade :
    0. pymupdf4llm — Markdown structuré (titres, tableaux, listes) ; repli si fidélité < seuil
    1. pdfplumber  — PDFs structurés standard (texte plat)
    2. PyMuPDF     — PDFs complexes / encodage non-standard
    3. OCR (PyMuPDF + pytesseract) — PDFs scannés (images)
    """

    async def parse(self, file_path: str) -> str:
        # Étape 0 : Markdown structuré (pymupdf4llm) — préserve titres, tableaux, listes.
        # Garde-fou : repli sur le texte plat si la conversion perd du contenu.
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
                    "repli sur le texte plat : %s",
                    _alnum_count(markdown), _alnum_count(baseline),
                    _FIDELITY_MIN_RATIO * 100, file_path,
                )

        # Étape 1 : pdfplumber
        text = self._try_pdfplumber(file_path)
        if text:
            return text

        # Étape 2 : PyMuPDF
        if _FITZ_AVAILABLE:
            text = self._try_pymupdf(file_path)
            if text:
                logger.info("PDF extrait via PyMuPDF : %s", file_path)
                return text

        # Étape 3 : OCR
        if _FITZ_AVAILABLE and _TESSERACT_AVAILABLE:
            logger.info("Lancement OCR sur %s (PDF scanné détecté)…", file_path)
            text = self._try_ocr(file_path)
            if text:
                logger.info("PDF extrait via OCR (%d caractères) : %s", len(text), file_path)
                return text

        logger.warning("Aucun texte extrait de %s", file_path)
        return ""

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
                    if text and text.strip():
                        pages.append(text.strip())
            return "\n\n".join(pages)
        except Exception as e:
            logger.debug("pdfplumber échoué sur %s : %s", file_path, e)
            return ""

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
                max_pages = min(n, 20)  # cap à 20 pages pour éviter les timeouts
                if n > 20:
                    logger.info("OCR limité aux 20 premières pages sur %d (PDF %s)", n, file_path)
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
