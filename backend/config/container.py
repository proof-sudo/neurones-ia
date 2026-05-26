"""
Dependency injection container.
Câble les ports (interfaces abstraites) aux adapters (implémentations concrètes).
Changer un adapter ici ne nécessite aucune modification dans les use cases.
"""
import logging
from pathlib import Path

from config.settings import settings

logger = logging.getLogger(__name__)


class Container:
    """Registre central des dépendances — instancié une fois au démarrage."""

    def __init__(self):
        self._llm_haiku = None
        self._llm_sonnet = None
        self._embedder = None
        self._vector_store = None
        self._sparse_search = None
        self._pdf_parser = None
        self._docx_parser = None
        self._ged_storage = None
        self._doc_registry = None
        self._crm_repo = None
        self._odoo_adapter = None
        self._cache = None
        self._token_budget = None
        self._rag_engine = None
        self._query_dispatcher = None
        self._ged_indexer = None
        self._data_shield = None
        self._scheduler = None
        self._ged_watcher = None

    async def startup(self):
        logger.info("Initialisation des adapters...")
        self._init_adapters()
        self._init_services()
        await self._start_jobs()
        logger.info("Container prêt.")

    async def shutdown(self):
        if self._scheduler:
            self._scheduler.shutdown(wait=False)
        if self._ged_watcher:
            self._ged_watcher.stop()
        if self._odoo_adapter:
            await self._odoo_adapter.close()

    def _init_adapters(self):
        from adapters.llm.claude_haiku_adapter import ClaudeHaikuAdapter
        from adapters.llm.claude_sonnet_adapter import ClaudeSonnetAdapter
        from adapters.embeddings.openai_embed_adapter import OpenAIEmbedAdapter
        from adapters.vector_store.chromadb_adapter import ChromaDBAdapter
        from adapters.sparse_search.bm25_adapter import BM25Adapter
        from adapters.parser.pdf_adapter import PDFAdapter
        from adapters.parser.docx_adapter import DocxAdapter
        from adapters.storage.local_ged_adapter import LocalGEDAdapter
        from adapters.registry.sqlite_registry_adapter import SQLiteRegistryAdapter
        from adapters.crm.local_crm_adapter import LocalCRMAdapter
        from adapters.cache.redis_adapter import RedisAdapter

        from adapters.llm.openai_gpt_adapter import OpenAIGPTAdapter
        from adapters.llm.fallback_llm_adapter import FallbackLLMAdapter

        _haiku = ClaudeHaikuAdapter()
        _sonnet = ClaudeSonnetAdapter()
        _gpt = OpenAIGPTAdapter()

        if settings.llm_fallback_enabled:
            if settings.ollama_enabled:
                from adapters.llm.ollama_adapter import OllamaAdapter
                _ollama = OllamaAdapter()
                # Chaîne 3 niveaux : Claude → GPT-4o-mini → Ollama local
                _gpt_with_local = FallbackLLMAdapter(primary=_gpt, fallback=_ollama)
                self._llm_haiku = FallbackLLMAdapter(primary=_haiku, fallback=_gpt_with_local)
                self._llm_sonnet = FallbackLLMAdapter(primary=_sonnet, fallback=_gpt_with_local)
                logger.info("LLM fallback activé : Claude → GPT-4o-mini → Ollama (%s)", settings.ollama_model)
            else:
                self._llm_haiku = FallbackLLMAdapter(primary=_haiku, fallback=_gpt)
                self._llm_sonnet = FallbackLLMAdapter(primary=_sonnet, fallback=_gpt)
                logger.info("LLM fallback activé : Claude → GPT-4o-mini")
        else:
            self._llm_haiku = _haiku
            self._llm_sonnet = _sonnet
        if settings.embed_fallback_enabled:
            from adapters.embeddings.sentence_transformers_adapter import SentenceTransformersAdapter
            from adapters.embeddings.fallback_embed_adapter import FallbackEmbedAdapter
            _local = SentenceTransformersAdapter(model_name=settings.embed_fallback_model)
            self._embedder = FallbackEmbedAdapter(primary=OpenAIEmbedAdapter(), fallback=_local)
            logger.info("Embed fallback activé : OpenAI → sentence-transformers (%s) si quota épuisé", settings.embed_fallback_model)
        else:
            self._embedder = OpenAIEmbedAdapter()
        self._vector_store = ChromaDBAdapter()
        self._sparse_search = BM25Adapter()
        self._pdf_parser = PDFAdapter()
        self._docx_parser = DocxAdapter()
        self._ged_storage = LocalGEDAdapter()
        self._doc_registry = SQLiteRegistryAdapter()
        from adapters.crm.odoo_adapter import OdooAdapter
        self._crm_repo = LocalCRMAdapter()
        self._odoo_adapter = OdooAdapter()
        self._cache = RedisAdapter()
        self._token_budget = self._build_token_budget()

    def _build_token_budget(self):
        from core.services.token_budget_manager import TokenBudgetManager
        return TokenBudgetManager(
            monthly_budget_fcfa=settings.token_budget_monthly_fcfa,
            alert_threshold_pct=settings.token_alert_threshold_pct,
        )

    def _init_services(self):
        from core.services.rag_engine import RAGEngine
        from core.services.query_dispatcher import QueryDispatcher
        from core.services.ged_indexer import GEDIndexer
        from core.services.data_shield import DataShield

        self._data_shield = DataShield()
        self._rag_engine = RAGEngine(
            vector_store=self._vector_store,
            sparse_search=self._sparse_search,
            embedder=self._embedder,
            llm=self._llm_haiku,
            top_k=settings.retrieval_top_k,
            rerank_top_k=settings.rerank_top_k,
        )
        self._query_dispatcher = QueryDispatcher(
            llm=self._llm_haiku,
            rag_engine=self._rag_engine,
            crm_repo=self._crm_repo,
        )
        self._ged_indexer = GEDIndexer(
            vector_store=self._vector_store,
            sparse_search=self._sparse_search,
            embedder=self._embedder,
            registry=self._doc_registry,
            pdf_parser=self._pdf_parser,
            docx_parser=self._docx_parser,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )

    async def _start_jobs(self):
        from jobs.scheduler import build_scheduler
        from watchers.ged_watcher import GEDWatcher

        self._scheduler = build_scheduler(
            ged_indexer=self._ged_indexer,
            crm_repo=self._crm_repo,
            odoo_sync_interval_hours=settings.odoo_sync_interval_hours,
        )
        self._scheduler.start()

        self._ged_watcher = GEDWatcher(
            ged_path=settings.ged_path,
            ged_indexer=self._ged_indexer,
        )
        self._ged_watcher.start()

    # --- Accesseurs publics (utilisés via FastAPI Depends) ---

    @property
    def llm_haiku(self):
        return self._llm_haiku

    @property
    def llm_sonnet(self):
        return self._llm_sonnet

    @property
    def rag_engine(self):
        return self._rag_engine

    @property
    def query_dispatcher(self):
        return self._query_dispatcher

    @property
    def ged_indexer(self):
        return self._ged_indexer

    @property
    def crm_repo(self):
        return self._crm_repo

    @property
    def token_budget(self):
        return self._token_budget

    @property
    def data_shield(self):
        return self._data_shield

    @property
    def odoo_adapter(self):
        return self._odoo_adapter

    @property
    def doc_registry(self):
        return self._doc_registry

    @property
    def pdf_parser(self):
        return self._pdf_parser

    @property
    def docx_parser(self):
        return self._docx_parser
