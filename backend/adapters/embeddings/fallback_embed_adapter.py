import logging

from core.ports.embedder import Embedder

logger = logging.getLogger(__name__)

# Mots-clés dans le message d'erreur qui indiquent un problème de quota/accès
_QUOTA_KEYWORDS = ("quota", "rate_limit", "ratelimit", "billing", "insufficient", "credit", "429")


def _is_quota_error(exc: Exception) -> bool:
    msg = f"{type(exc).__name__} {exc}".lower()
    return any(kw in msg for kw in _QUOTA_KEYWORDS)


class FallbackEmbedAdapter(Embedder):
    """
    Essaie l'embedder primaire (OpenAI). Si une erreur de quota / authentification
    est détectée, bascule définitivement sur l'embedder de fallback (sentence-transformers local).

    ⚠️  Si les dimensions diffèrent (ex. OpenAI 1536 → local 384), ChromaDB va détecter
    le changement et recréer sa collection automatiquement. Tous les documents devront
    être réindexés via le bouton 'Réindexer' de l'interface.
    """

    def __init__(self, primary: Embedder, fallback: Embedder):
        self._primary = primary
        self._fallback = fallback
        self._using_fallback = False

    # ── API publique ──────────────────────────────────────────────────────────

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if self._using_fallback:
            return await self._fallback.embed_texts(texts)
        try:
            return await self._primary.embed_texts(texts)
        except Exception as exc:
            if _is_quota_error(exc):
                logger.warning(
                    "OpenAI embeddings indisponibles (quota/auth) → bascule sur le modèle local. "
                    "Cause : %s",
                    exc,
                )
                self._using_fallback = True
                return await self._fallback.embed_texts(texts)
            raise

    async def embed_query(self, query: str) -> list[float]:
        return (await self.embed_texts([query]))[0]

    @property
    def dimension(self) -> int:
        return self._fallback.dimension if self._using_fallback else self._primary.dimension

    # ── Infos de debug ────────────────────────────────────────────────────────

    @property
    def active_model(self) -> str:
        return "local (sentence-transformers)" if self._using_fallback else "openai"

    def reset_to_primary(self) -> None:
        """Force le retour vers OpenAI (utile après rechargement des crédits)."""
        self._using_fallback = False
        logger.info("FallbackEmbedAdapter : retour au modèle primaire OpenAI")
