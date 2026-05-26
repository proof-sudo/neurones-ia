import asyncio
import hashlib
import logging
import uuid
from datetime import datetime
from pathlib import Path

from core.ports.vector_store import VectorStore
from core.ports.sparse_search import SparseSearch
from core.ports.embedder import Embedder
from core.ports.document_registry import DocumentRegistry
from core.ports.document_parser import DocumentParser
from core.domain.document import Chunk, Document, GEDEntry, DocumentType, DocumentMetadata

logger = logging.getLogger(__name__)

_EMBED_BATCH = 96  # Safe batch size pour OpenAI (évite rate-limit + erreur 400)


class GEDIndexer:
    """
    Pipeline d'indexation incrémentale de la GED.
    Seul le fichier dont le hash a changé est re-traité.
    """

    def __init__(
        self,
        vector_store: VectorStore,
        sparse_search: SparseSearch,
        embedder: Embedder,
        registry: DocumentRegistry,
        pdf_parser: DocumentParser,
        docx_parser: DocumentParser,
        chunk_size: int = 600,
        chunk_overlap: int = 60,
    ):
        self._vector_store = vector_store
        self._sparse_search = sparse_search
        self._embedder = embedder
        self._registry = registry
        self._parsers: list[DocumentParser] = [pdf_parser, docx_parser]
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap

    async def process(self, file_path: Path, doc_type: DocumentType = DocumentType.UNKNOWN) -> bool:
        """
        Indexe un fichier si son contenu a changé depuis la dernière indexation.
        Retourne True si le fichier a été (re-)indexé, False si ignoré (hash identique).
        """
        file_str = str(file_path)

        # Hash en thread (IO synchrone, ne pas bloquer la boucle)
        current_hash = await asyncio.to_thread(self._compute_hash_sync, file_path)

        existing = await self._registry.get_entry(file_str)
        if existing and existing.hash_sha256 == current_hash:
            logger.debug("Fichier inchangé, skip : %s", file_path.name)
            return False

        text = await self._parse(file_path)
        if not text.strip():
            logger.warning("Aucun texte extrait de %s", file_path.name)
            return False

        if existing:
            await self._vector_store.delete_by_doc_id(existing.doc_id)
            self._sparse_search.remove(existing.vector_ids)
            doc_id = existing.doc_id
        else:
            doc_id = str(uuid.uuid4())

        metadata = DocumentMetadata(
            doc_id=doc_id,
            filename=file_path.name,
            doc_type=doc_type,
            source_path=file_str,
        )
        chunks = self._chunk_text(text, doc_id, metadata)
        if not chunks:
            logger.warning("Aucun chunk généré pour %s", file_path.name)
            return False

        # Embeddings en batches pour éviter rate-limit OpenAI
        embeddings: list[list[float]] = []
        contents = [c.content for c in chunks]
        for i in range(0, len(contents), _EMBED_BATCH):
            batch = contents[i : i + _EMBED_BATCH]
            batch_emb = await self._embedder.embed_texts(batch)
            embeddings.extend(batch_emb)

        await self._vector_store.upsert(chunks, embeddings)

        # BM25 rebuild en thread (synchrone, potentiellement lent avec gros corpus)
        bm25_chunks = [(c.chunk_id, c.content) for c in chunks]
        await asyncio.to_thread(self._sparse_search.index, bm25_chunks)
        await asyncio.to_thread(self._sparse_search.save)

        entry = GEDEntry(
            doc_id=doc_id,
            file_path=file_str,
            hash_sha256=current_hash,
            doc_type=doc_type,
            last_indexed=datetime.utcnow(),
            vector_ids=[c.chunk_id for c in chunks],
            is_active=True,
        )
        await self._registry.upsert_entry(entry)

        logger.info("Indexé : %s → %d chunks (doc_id=%s)", file_path.name, len(chunks), doc_id)
        return True

    async def remove(self, file_path: Path) -> None:
        """Supprime un fichier du RAG (suite à suppression dans la GED)."""
        file_str = str(file_path)
        entry = await self._registry.get_entry(file_str)
        if entry:
            await self._vector_store.delete_by_doc_id(entry.doc_id)
            self._sparse_search.remove(entry.vector_ids)
            await asyncio.to_thread(self._sparse_search.save)
            await self._registry.mark_deleted(file_str)
            logger.info("Supprimé du RAG : %s", file_path.name)

    @staticmethod
    def _compute_hash_sync(file_path: Path) -> str:
        """Synchrone — à appeler via asyncio.to_thread."""
        h = hashlib.sha256()
        with open(file_path, "rb") as f:
            for block in iter(lambda: f.read(65536), b""):
                h.update(block)
        return h.hexdigest()

    async def _parse(self, file_path: Path) -> str:
        for parser in self._parsers:
            if parser.supports(str(file_path)):
                return await parser.parse(str(file_path))
        if file_path.suffix == ".txt":
            return file_path.read_text(encoding="utf-8", errors="ignore")
        return ""

    def _chunk_text(self, text: str, doc_id: str, metadata: DocumentMetadata) -> list[Chunk]:
        words = text.split()
        if not words:
            return []
        chunks = []
        step = max(1, self._chunk_size - self._chunk_overlap)
        for i, start in enumerate(range(0, len(words), step)):
            chunk_words = words[start : start + self._chunk_size]
            if len(chunk_words) < 20:  # Skip chunks vides ou trop courts
                continue
            chunks.append(Chunk(
                chunk_id=f"{doc_id}_chunk_{i}",
                doc_id=doc_id,
                content=" ".join(chunk_words),
                token_count=len(chunk_words),
                chunk_index=i,
                metadata=metadata,
            ))
        return chunks
