from abc import ABC, abstractmethod
from typing import Optional

from core.domain.document import Chunk, Source


class VectorStore(ABC):
    """Interface abstraite pour le stockage vectoriel dense (ChromaDB → pgvector en prod)."""

    @abstractmethod
    async def upsert(self, chunks: list[Chunk], embeddings: list[list[float]]) -> None:
        """Insère ou met à jour des chunks avec leurs embeddings."""

    @abstractmethod
    async def search_dense(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        filter_metadata: Optional[dict] = None,
    ) -> list[Source]:
        """Recherche sémantique par similarité cosinus."""

    @abstractmethod
    async def delete_by_doc_id(self, doc_id: str) -> None:
        """Supprime tous les chunks d'un document (avant re-indexation)."""

    @abstractmethod
    async def get_doc_ids(self) -> list[str]:
        """Retourne tous les doc_ids indexés."""

    @abstractmethod
    async def get_by_chunk_ids(self, chunk_ids: list[str]) -> list[Source]:
        """Récupère des chunks par leur id exact (pour résoudre les hits BM25-only en Source)."""
