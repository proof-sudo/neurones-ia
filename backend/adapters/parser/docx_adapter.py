import logging

from docx import Document as DocxDocument

from core.ports.document_parser import DocumentParser

logger = logging.getLogger(__name__)


class DocxAdapter(DocumentParser):
    """Extraction de texte depuis les fichiers Word (.docx) via python-docx."""

    async def parse(self, file_path: str) -> str:
        try:
            doc = DocxDocument(file_path)
            parts: list[str] = []

            # Paragraphes (corps + listes)
            for p in doc.paragraphs:
                text = p.text.strip()
                if text:
                    parts.append(text)

            # Tableaux (dédoublonnage des cellules fusionnées)
            for table in doc.tables:
                seen_cells: set[str] = set()
                for row in table.rows:
                    row_cells = []
                    for cell in row.cells:
                        cell_text = cell.text.strip()
                        if cell_text and cell_text not in seen_cells:
                            row_cells.append(cell_text)
                            seen_cells.add(cell_text)
                    if row_cells:
                        parts.append(" | ".join(row_cells))

            # Nettoyage : supprimer les caractères de contrôle non-imprimables
            cleaned = "\n\n".join(parts)
            cleaned = "".join(ch for ch in cleaned if ch >= " " or ch in "\n\t")
            return cleaned
        except Exception as e:
            logger.warning("Erreur parsing DOCX %s: %s", file_path, e)
            return ""

    def supports(self, file_path: str) -> bool:
        return file_path.lower().endswith((".docx", ".doc"))
