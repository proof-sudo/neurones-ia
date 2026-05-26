import asyncio
import logging
from collections import OrderedDict

from openai import AsyncOpenAI, APIConnectionError, RateLimitError

from core.ports.embedder import Embedder
from config.settings import settings

logger = logging.getLogger(__name__)

# Cache LRU en mémoire — évite les appels API répétés pour la même question
# Clé = (model, query) pour invalider automatiquement si le modèle change
_QUERY_CACHE: "OrderedDict[tuple[str,str], list[float]]" = OrderedDict()
_QUERY_CACHE_MAX = 256
_QUERY_CACHE_TTL = 3600  # 1h — au-delà les embeddings peuvent être périmés (changement de modèle)
_QUERY_CACHE_TIMES: "dict[tuple[str,str], float]" = {}


class OpenAIEmbedAdapter(Embedder):
    """
    Embeddings via OpenAI text-embedding-3-small.
    Cache LRU (256 entrées, 1h TTL) + retry x3 + timeout 30s.
    """

    DIMENSION = 1536

    def __init__(self):
        self._client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=30.0,
            max_retries=0,  # On gère les retries manuellement
        )
        self._model = settings.embedding_model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                response = await self._client.embeddings.create(
                    model=self._model,
                    input=texts,
                )
                return [item.embedding for item in response.data]
            except (APIConnectionError, RateLimitError) as e:
                last_exc = e
                wait = 1.5 ** attempt
                logger.warning("OpenAI embed retry %d/3 (%s) — attente %.1fs", attempt + 1, e, wait)
                await asyncio.sleep(wait)
            except Exception as e:
                raise e
        raise last_exc  # type: ignore

    async def embed_query(self, query: str) -> list[float]:
        import time
        key = (self._model, query.strip().lower())
        now = time.monotonic()

        # Vérifie cache + TTL
        if key in _QUERY_CACHE:
            age = now - _QUERY_CACHE_TIMES.get(key, 0)
            if age < _QUERY_CACHE_TTL:
                _QUERY_CACHE.move_to_end(key)
                return _QUERY_CACHE[key]
            else:
                _QUERY_CACHE.pop(key, None)
                _QUERY_CACHE_TIMES.pop(key, None)

        embeddings = await self.embed_texts([query])
        result = embeddings[0]

        _QUERY_CACHE[key] = result
        _QUERY_CACHE_TIMES[key] = now
        _QUERY_CACHE.move_to_end(key)
        if len(_QUERY_CACHE) > _QUERY_CACHE_MAX:
            oldest_key = next(iter(_QUERY_CACHE))
            _QUERY_CACHE.pop(oldest_key, None)
            _QUERY_CACHE_TIMES.pop(oldest_key, None)

        return result

    @property
    def dimension(self) -> int:
        return self.DIMENSION
