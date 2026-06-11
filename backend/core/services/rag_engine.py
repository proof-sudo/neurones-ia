import asyncio
import logging
from typing import Optional

from config.settings import settings
from core.ports.vector_store import VectorStore
from core.ports.sparse_search import SparseSearch
from core.ports.embedder import Embedder
from core.ports.llm_gateway import LLMGateway
from core.domain.document import Source

logger = logging.getLogger(__name__)


class RAGEngine:
    """
    Recherche hybride : Dense (ChromaDB) + Sparse (BM25) → RRF fusion.
    Dense et sparse lancés en parallèle. Pas de reranker LLM (trop lent, RRF suffit).
    """

    def __init__(
        self,
        vector_store: VectorStore,
        sparse_search: SparseSearch,
        embedder: Embedder,
        llm: LLMGateway,
        top_k: int = 10,
        rerank_top_k: int = 5,
    ):
        self._vector_store = vector_store
        self._sparse_search = sparse_search
        self._embedder = embedder
        self._llm = llm
        self._top_k = top_k
        self._rerank_top_k = rerank_top_k

    async def search(
        self,
        query: str,
        filter_metadata: Optional[dict] = None,
        top_k: Optional[int] = None,
    ) -> list[Source]:
        """
        Pipeline hybride parallèle :
        1. embed_query (OpenAI) en parallèle avec sparse search (BM25, synchrone)
        2. Dense search (ChromaDB) sur le résultat de l'embedding
        3. RRF fusion + dédoublonnage par filename
        → retourne max rerank_top_k sources uniques
        """
        effective_top_k = top_k or self._top_k

        # Lancer embed + BM25 en parallèle (BM25 est synchrone → threadpool)
        embed_task = asyncio.create_task(self._embedder.embed_query(query))
        sparse_task = asyncio.create_task(
            asyncio.to_thread(self._sparse_search.search, query, effective_top_k)
        )
        query_embedding, sparse_results = await asyncio.gather(embed_task, sparse_task)

        dense_results = await self._vector_store.search_dense(
            query_embedding=query_embedding,
            top_k=effective_top_k,
            filter_metadata=filter_metadata,
        )

        # Vrai hybride : un document trouvé UNIQUEMENT par BM25 (match lexical exact, ex.
        # "Commvault") n'est pas dans le top-k dense. On résout son meilleur chunk en Source
        # pour qu'il puisse remonter dans la fusion, au lieu d'être silencieusement jeté.
        extra_sources = await self._resolve_sparse_only(
            sparse_results, dense_results, filter_metadata
        )

        fused = self._reciprocal_rank_fusion(dense_results, sparse_results, extra_sources)

        # Dédoublonnage par filename
        seen_filenames: set[str] = set()
        unique: list[Source] = []
        for src in fused:
            if src.filename not in seen_filenames:
                unique.append(src)
                seen_filenames.add(src.filename)

        top = unique[: self._rerank_top_k]
        logger.debug("RAG: %d sources uniques pour '%s'", len(top), query[:50])
        return top

    async def search_diverse(
        self,
        query: str,
        doc_types: list[str],
        per_type: int = 2,
    ) -> list[Source]:
        """
        Recherche par type de document en parallèle (plus rapide que séquentiel).
        Fallback général si résultats insuffisants.
        """
        tasks = [
            self.search(query=query, filter_metadata={"doc_type": dt}, top_k=per_type * 3)
            for dt in doc_types
        ]
        results_per_type = await asyncio.gather(*tasks, return_exceptions=True)

        all_sources: list[Source] = []
        seen_filenames: set[str] = set()

        for res in results_per_type:
            if isinstance(res, Exception):
                logger.debug("search_diverse partiel: %s", res)
                continue
            count = 0
            for src in res:
                if src.filename not in seen_filenames and count < per_type:
                    all_sources.append(src)
                    seen_filenames.add(src.filename)
                    count += 1

        # Fallback si trop peu de résultats
        if len(all_sources) < 3:
            try:
                general = await self.search(query=query, top_k=10)
                for src in general:
                    if src.filename not in seen_filenames:
                        all_sources.append(src)
                        seen_filenames.add(src.filename)
            except Exception:
                pass

        all_sources.sort(key=lambda s: s.relevance_score, reverse=True)
        return all_sources

    async def build_context(self, sources: list[Source], max_tokens: int = 3000) -> str:
        if not sources:
            return ""
        parts = []
        total = 0
        for src in sources:
            # On garde l'excerpt quasi entier (un chunk ~600 mots) : le couper à 600 chars
            # ne laissait au LLM que ~8% d'un CV/offre → notation sur des bribes.
            excerpt = src.excerpt[: settings.excerpt_chars]
            entry = f"[{src.filename} | {src.doc_type.value}]\n{excerpt}"
            entry_tokens = len(entry.split())
            if total + entry_tokens > max_tokens:
                break
            parts.append(entry)
            total += entry_tokens
        return "\n\n---\n\n".join(parts)

    @staticmethod
    def _doc_id_of(chunk_id: str) -> str:
        """Extrait le doc_id d'un chunk_id de la forme '<doc_id>_chunk_<n>'."""
        parts = chunk_id.rsplit("_chunk_", 1)
        return parts[0] if len(parts) == 2 else chunk_id

    async def _resolve_sparse_only(
        self,
        sparse: list[tuple[str, float]],
        dense: list[Source],
        filter_metadata: Optional[dict],
    ) -> list[Source]:
        """Résout en Source les documents trouvés UNIQUEMENT par BM25 (absents du dense).

        BM25 n'applique aucun filtre de métadonnée : on récupère le meilleur chunk de chaque
        doc sparse-only via le vector store puis on filtre par doc_type (si demandé), pour ne
        pas faire entrer des documents du mauvais type dans une recherche filtrée.
        """
        if not sparse:
            return []
        dense_doc_ids = {s.doc_id for s in dense}
        # Meilleur chunk_id par doc_id côté sparse
        best_chunk: dict[str, tuple[str, float]] = {}
        for cid, score in sparse:
            doc_id = self._doc_id_of(cid)
            if doc_id in dense_doc_ids:
                continue  # déjà couvert par le dense
            cur = best_chunk.get(doc_id)
            if cur is None or score > cur[1]:
                best_chunk[doc_id] = (cid, score)
        if not best_chunk:
            return []

        try:
            resolved = await self._vector_store.get_by_chunk_ids(
                [cid for cid, _ in best_chunk.values()]
            )
        except Exception as exc:
            logger.debug("Résolution sparse-only échouée (%s) — hybride dégradé sur cette requête", exc)
            return []

        wanted_type = (filter_metadata or {}).get("doc_type")
        if wanted_type:
            resolved = [s for s in resolved if s.doc_type.value == wanted_type]
        if resolved:
            logger.debug("Hybride : %d doc(s) BM25-only réintégré(s)", len(resolved))
        return resolved

    def _reciprocal_rank_fusion(
        self,
        dense: list[Source],
        sparse: list[tuple[str, float]],
        extra: Optional[list[Source]] = None,
        k: int = 60,
    ) -> list[Source]:
        scores: dict[str, float] = {}
        doc_map: dict[str, Source] = {}

        for rank, src in enumerate(dense):
            scores[src.doc_id] = scores.get(src.doc_id, 0) + 1 / (k + rank + 1)
            doc_map[src.doc_id] = src

        # Documents trouvés uniquement par BM25, déjà résolus en Source : on les enregistre
        # dans doc_map pour qu'ils soient éligibles au résultat final (ne pas les écraser).
        for src in (extra or []):
            doc_map.setdefault(src.doc_id, src)

        sparse_map: dict[str, float] = {}
        for cid, score in sparse:
            doc_id = self._doc_id_of(cid)
            sparse_map[doc_id] = max(sparse_map.get(doc_id, 0), score)

        for rank, (doc_id, _) in enumerate(sorted(sparse_map.items(), key=lambda x: -x[1])):
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)

        sorted_ids = sorted(scores, key=lambda x: -scores[x])
        result = []
        for doc_id in sorted_ids:
            if doc_id in doc_map:
                src = doc_map[doc_id]
                result.append(Source(
                    doc_id=src.doc_id,
                    filename=src.filename,
                    doc_type=src.doc_type,
                    excerpt=src.excerpt,
                    relevance_score=scores[doc_id],
                ))
        return result
