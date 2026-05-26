"""
Script Phase 0 — Indexation initiale de la GED.
Lance manuellement : python scripts/initial_ingest.py

Parcourt data/ged/, extrait le texte, chunke, embeddise et indexe dans ChromaDB + BM25.
Seuls les fichiers non encore indexés (ou modifiés) sont traités.
"""
import asyncio
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


async def main():
    from config.settings import settings
    from adapters.llm.claude_haiku_adapter import ClaudeHaikuAdapter
    from adapters.embeddings.openai_embed_adapter import OpenAIEmbedAdapter
    from adapters.vector_store.chromadb_adapter import ChromaDBAdapter
    from adapters.sparse_search.bm25_adapter import BM25Adapter
    from adapters.parser.pdf_adapter import PDFAdapter
    from adapters.parser.docx_adapter import DocxAdapter
    from adapters.registry.sqlite_registry_adapter import SQLiteRegistryAdapter
    from adapters.storage.local_ged_adapter import LocalGEDAdapter, _TYPE_MAP
    from core.services.ged_indexer import GEDIndexer
    from db.database import init_db

    await init_db()

    indexer = GEDIndexer(
        vector_store=ChromaDBAdapter(),
        sparse_search=BM25Adapter(),
        embedder=OpenAIEmbedAdapter(),
        registry=SQLiteRegistryAdapter(),
        pdf_parser=PDFAdapter(),
        docx_parser=DocxAdapter(),
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )

    storage = LocalGEDAdapter()
    total = 0
    indexed = 0

    for folder_name, doc_type in _TYPE_MAP.items():
        files = storage.list_files(doc_type)
        logger.info("Dossier [%s] : %d fichiers trouvés", folder_name, len(files))
        for file_path in files:
            total += 1
            try:
                was_indexed = await indexer.process(file_path, doc_type)
                if was_indexed:
                    indexed += 1
            except Exception as e:
                logger.error("Erreur [%s] : %s", file_path.name, e)

    logger.info("=" * 50)
    logger.info("Indexation terminée : %d/%d fichiers traités", indexed, total)
    logger.info("Fichiers inchangés (skipped) : %d", total - indexed)


if __name__ == "__main__":
    asyncio.run(main())
