import json
import logging
from typing import Optional

import chromadb

from core.ports.vector_store import VectorStore
from core.domain.document import Chunk, Source, DocumentType
from config.settings import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "neurones_ged"


class ChromaDBAdapter(VectorStore):
    """ChromaDB local pour le MVP — remplaçable par pgvector sans toucher les use cases."""

    def __init__(self):
        self._client = chromadb.PersistentClient(path=str(settings.chromadb_path))
        self._collection = self._get_or_create_collection()
        # Cache le count pour éviter un full-scan metadata à chaque recherche
        self._approx_count: int = self._collection.count()
        logger.info("ChromaDB initialisé — %d chunks indexés", self._approx_count)

    def _get_or_create_collection(self):
        return self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def _recreate_collection(self) -> None:
        logger.warning(
            "ChromaDB : dimension d'embedding changée — suppression de la collection '%s'. "
            "Tous les documents devront être réindexés via le bouton 'Réindexer'.",
            COLLECTION_NAME,
        )
        self._client.delete_collection(COLLECTION_NAME)
        self._collection = self._get_or_create_collection()
        self._approx_count = 0

    async def upsert(self, chunks: list[Chunk], embeddings: list[list[float]]) -> None:
        if not chunks:
            return
        metadatas = [self._build_metadata(c) for c in chunks]
        try:
            self._collection.upsert(
                ids=[c.chunk_id for c in chunks],
                embeddings=embeddings,
                documents=[c.content for c in chunks],
                metadatas=metadatas,
            )
            self._approx_count += len(chunks)
        except Exception as exc:
            if "dimension" in str(exc).lower() or "InvalidDimensionException" in type(exc).__name__:
                self._recreate_collection()
                self._collection.upsert(
                    ids=[c.chunk_id for c in chunks],
                    embeddings=embeddings,
                    documents=[c.content for c in chunks],
                    metadatas=metadatas,
                )
                self._approx_count = len(chunks)
            else:
                raise
        logger.debug("Upsert %d chunks pour doc_id=%s", len(chunks), chunks[0].doc_id)

    async def search_dense(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        filter_metadata: Optional[dict] = None,
    ) -> list[Source]:
        where = filter_metadata if filter_metadata else None
        # Utiliser le count caché — évite un full-scan metadata (~50-200ms)
        n = max(1, min(top_k, self._approx_count or top_k))
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=n,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        sources = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            sources.append(
                Source(
                    doc_id=meta["doc_id"],
                    filename=meta["filename"],
                    doc_type=DocumentType(meta.get("doc_type", "unknown")),
                    excerpt=doc[:300],
                    relevance_score=1.0 - dist,
                )
            )
        return sources

    async def delete_by_doc_id(self, doc_id: str) -> None:
        results = self._collection.get(where={"doc_id": doc_id})
        if results["ids"]:
            self._collection.delete(ids=results["ids"])
            self._approx_count = max(0, self._approx_count - len(results["ids"]))
            logger.info("Supprimé %d chunks pour doc_id=%s", len(results["ids"]), doc_id)

    @staticmethod
    def _build_metadata(c: Chunk) -> dict:
        """
        Construit le dict de métadonnées ChromaDB.
        Contrainte ChromaDB : les valeurs doivent être str | int | float | bool.
        Les listes et dicts extraits sont JSON-sérialisés en str.
        """
        meta = {
            "doc_id": c.doc_id,
            "filename": c.metadata.filename,
            "doc_type": c.metadata.doc_type.value,
            "client_id": c.metadata.client_id or "",
            "chunk_index": c.chunk_index,
            "is_parent": c.is_parent,
            "parent_chunk_id": c.parent_chunk_id or "",
            "contains_pii": c.metadata.contains_pii,
        }
        # Aplatir les champs extraits (scalaires directs, listes → JSON)
        for key, value in (c.metadata.extracted_fields or {}).items():
            if isinstance(value, (str, int, float, bool)):
                meta[f"ef_{key}"] = value
            elif value is not None:
                meta[f"ef_{key}"] = json.dumps(value, ensure_ascii=False)
        return meta

    async def get_doc_ids(self) -> list[str]:
        results = self._collection.get(include=["metadatas"])
        return list({m["doc_id"] for m in results["metadatas"]})
