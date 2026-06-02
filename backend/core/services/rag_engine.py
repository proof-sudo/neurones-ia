import asyncio
import logging
from typing import Optional

from core.ports.vector_store import VectorStore
from core.ports.sparse_search import SparseSearch
from core.ports.embedder import Embedder
from core.ports.llm_gateway import LLMGateway
from core.domain.document import Source, DocumentType

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
        max_per_doc: int = 2,
    ):
        self._vector_store = vector_store
        self._sparse_search = sparse_search
        self._embedder = embedder
        self._llm = llm
        self._top_k = top_k
        self._rerank_top_k = rerank_top_k
        self._max_per_doc = max_per_doc

    async def search(
        self,
        query: str,
        filter_metadata: Optional[dict] = None,
        top_k: Optional[int] = None,
    ) -> list[Source]:
        """
        Pipeline hybride parallèle, fusionné AU NIVEAU CHUNK :
        1. embed_query en parallèle avec sparse search (BM25, synchrone)
        2. Dense search (ChromaDB) sur le résultat de l'embedding
        3. RRF fusion par chunk_id (dense + BM25), enrichissement des chunks BM25-only
        4. Classement RRF + diversité (max_per_doc chunks par document)
        → retourne max rerank_top_k chunks, chacun avec son contenu complet
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

        # ── Fusion RRF par chunk_id (dense et BM25 partagent la même clé) ──────
        k = 60
        scores: dict[str, float] = {}
        by_chunk: dict[str, Source] = {}
        for rank, src in enumerate(dense_results):
            cid = src.chunk_id or src.doc_id
            scores[cid] = scores.get(cid, 0.0) + 1 / (k + rank + 1)
            by_chunk[cid] = src
        for rank, (cid, _score) in enumerate(sparse_results):
            scores[cid] = scores.get(cid, 0.0) + 1 / (k + rank + 1)

        # Enrichir les chunks remontés UNIQUEMENT par BM25 (absents du dense).
        # Sans filtre dense : le filtre metadata ne s'applique pas à BM25, donc on
        # respecte tout de même filter_metadata en écartant les types non voulus.
        missing = [cid for cid in scores if cid not in by_chunk]
        if missing:
            enriched = await self._vector_store.get_by_chunk_ids(missing)
            wanted_type = (filter_metadata or {}).get("doc_type")
            for cid, data in enriched.items():
                meta = data["metadata"]
                if wanted_type and meta.get("doc_type") != wanted_type:
                    continue
                content = data["content"] or ""
                by_chunk[cid] = Source(
                    doc_id=meta.get("doc_id", ""),
                    filename=meta.get("filename", "?"),
                    doc_type=DocumentType(meta.get("doc_type", "unknown")),
                    excerpt=content[:300],
                    relevance_score=0.0,
                    chunk_id=cid,
                    content=content,
                )

        # ── Classement + diversité (cap par document) ─────────────────────────
        ranked_ids = sorted(
            (cid for cid in scores if cid in by_chunk),
            key=lambda c: scores[c],
            reverse=True,
        )
        per_doc: dict[str, int] = {}
        result: list[Source] = []
        for cid in ranked_ids:
            src = by_chunk[cid]
            if per_doc.get(src.doc_id, 0) >= self._max_per_doc:
                continue
            per_doc[src.doc_id] = per_doc.get(src.doc_id, 0) + 1
            result.append(Source(
                doc_id=src.doc_id,
                filename=src.filename,
                doc_type=src.doc_type,
                excerpt=src.excerpt,
                relevance_score=scores[cid],
                chunk_id=cid,
                content=src.content,
            ))
            if len(result) >= self._rerank_top_k:
                break

        logger.debug("RAG: %d chunks (%d docs) pour '%s'", len(result), len(per_doc), query[:50])
        return result

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
        """Assemble le contexte LLM à partir du CONTENU COMPLET des chunks, borné
        par max_tokens (estimé en mots). La dernière entrée est tronquée plutôt
        qu'écartée pour remplir le budget sans dépasser."""
        if not sources:
            return ""
        parts: list[str] = []
        total = 0
        for src in sources:
            body = src.content or src.excerpt
            header = f"[{src.filename} | {src.doc_type.value}]\n"
            words = body.split()
            entry_tokens = len(header.split()) + len(words)
            if total + entry_tokens > max_tokens:
                remaining = max_tokens - total - len(header.split())
                if remaining > 50:
                    parts.append(header + " ".join(words[:remaining]))
                break
            parts.append(header + body)
            total += entry_tokens
        return "\n\n---\n\n".join(parts)

    async def search_debug(
        self,
        query: str,
        top_k: int = 10,
        doc_type: Optional[str] = None,
        rrf_k: int = 60,
    ) -> dict:
        """
        Variante d'inspection (non utilisée en prod) : retourne le détail chunk par
        chunk avec les scores dense, sparse (BM25) et RRF séparés, SANS dédoublonnage
        par filename. Sert le playground de la page GED pour visualiser ce que le
        retrieval remonte réellement.
        """
        embed_task = asyncio.create_task(self._embedder.embed_query(query))
        sparse_task = asyncio.create_task(
            asyncio.to_thread(self._sparse_search.search, query, top_k)
        )
        query_embedding, sparse_results = await asyncio.gather(embed_task, sparse_task)

        dense_results = await self._vector_store.search_dense_debug(
            query_embedding=query_embedding,
            top_k=top_k,
            doc_type=doc_type,
        )

        # Agrégation par chunk_id
        chunks: dict[str, dict] = {}
        for rank, d in enumerate(dense_results):
            chunks[d["chunk_id"]] = {
                **d,
                "dense_rank": rank + 1,
                "dense_score": d["score"],
                "sparse_rank": None,
                "sparse_score": None,
                "rrf_score": 1 / (rrf_k + rank + 1),
            }

        for rank, (cid, score) in enumerate(sparse_results):
            entry = chunks.get(cid)
            if entry is None:
                entry = {
                    "chunk_id": cid, "doc_id": None, "filename": None,
                    "doc_type": None, "content": None,
                    "dense_rank": None, "dense_score": None,
                    "rrf_score": 0.0,
                }
                chunks[cid] = entry
            entry["sparse_rank"] = rank + 1
            entry["sparse_score"] = round(float(score), 4)
            entry["rrf_score"] += 1 / (rrf_k + rank + 1)

        # Enrichir les chunks trouvés uniquement par BM25 (contenu absent du dense)
        missing = [cid for cid, c in chunks.items() if c["content"] is None]
        if missing:
            enriched = await self._vector_store.get_by_chunk_ids(missing)
            for cid, data in enriched.items():
                meta = data["metadata"]
                chunks[cid].update({
                    "doc_id": meta.get("doc_id"),
                    "filename": meta.get("filename"),
                    "doc_type": meta.get("doc_type", "unknown"),
                    "content": data["content"],
                })

        ranked = sorted(chunks.values(), key=lambda c: c["rrf_score"], reverse=True)
        for c in ranked:
            c["rrf_score"] = round(c["rrf_score"], 6)
            if c.get("content"):
                c["excerpt"] = c["content"][:500]
                c["word_count"] = len(c["content"].split())
            else:
                c["excerpt"] = ""
                c["word_count"] = 0
            c.pop("content", None)
            c.pop("score", None)

        return {
            "query": query,
            "doc_type": doc_type,
            "top_k": top_k,
            "dense_hits": len(dense_results),
            "sparse_hits": len(sparse_results),
            "results": ranked[:top_k],
        }
