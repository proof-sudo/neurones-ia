from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # LLM
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Models
    haiku_model: str = "claude-haiku-4-5-20251001"
    sonnet_model: str = "claude-sonnet-4-6"
    embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    llm_fallback_enabled: bool = True        # bascule auto sur OpenAI si Anthropic tombe
    # Ollama — modèle local (3ème niveau de fallback)
    ollama_enabled: bool = True
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"           # ollama pull llama3.1 (ou mistral-nemo, qwen2.5)
    ollama_timeout_seconds: float = 120.0    # modèles locaux peuvent être lents au premier appel
    # Backend d'embedding : "local" (sentence-transformers, indépendant du quota OpenAI)
    # ou "openai" (text-embedding-3-small). "local" = UN SEUL modèle indexation + requête
    # → évite tout mélange de dimensions (Cause A).
    embedding_backend: str = "local"
    embed_fallback_enabled: bool = True      # bascule sur sentence-transformers si OpenAI indisponible
    embed_fallback_model: str = "paraphrase-multilingual-MiniLM-L12-v2"   # local multilingue (FR), 384d

    # Odoo (serveur distant)
    odoo_url: str = ""
    odoo_db: str = ""
    odoo_username: str = ""
    odoo_password: str = ""
    odoo_sync_interval_hours: int = 2   # fallback legacy
    odoo_sync_interval_minutes: int = 2  # sync incrémentale rapide
    odoo_webhook_secret: str = ""        # HMAC secret pour les webhooks Odoo

    # Chemins données
    ged_path: Path = Path("../data/ged")
    templates_path: Path = Path("../data/templates")
    uploads_path: Path = Path("../data/uploads")
    chromadb_path: Path = Path("../data/chromadb")
    bm25_index_path: Path = Path("../data/bm25_index")
    local_db_path: Path = Path("../data/local_db/neurones.db")

    # RAG
    chunk_size: int = 600
    chunk_overlap: int = 60
    retrieval_top_k: int = 10
    rerank_top_k: int = 5
    max_context_tokens: int = 10000   # budget contexte RAG (tokens réels) ; Haiku gère 200k, 3000 tronquait les parents

    # Extraction structurée (couche kb_*) — Phase 1
    extraction_confidence_threshold: float = 0.6   # sous ce score → revue_humaine=True
    structured_extract_text_limit: int = 8000       # nb de caractères envoyés au LLM

    # Résolution d'entités (Phase 2)
    entity_match_auto_threshold: float = 0.90       # ≥ → lien automatique
    entity_match_review_threshold: float = 0.75      # [review, auto[ → revue humaine

    # Text-to-SQL lecture seule (Phase 3)
    sql_query_timeout_seconds: float = 8.0           # timeout applicatif d'une requête générée

    # Reranker (P6) — cross-encoder local optionnel après la fusion RRF
    rerank_enabled: bool = False     # si True, le chat re-classe par défaut
    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rerank_candidates: int = 20      # nb de candidats RRF re-scorés par le cross-encoder

    # Chat
    max_history_turns: int = 6

    # Budget tokens
    token_budget_monthly_fcfa: int = 130_000
    token_alert_threshold_pct: int = 80

    # Quarantaine — auto-suppression des fichiers non indexables (ex. PDF scannés
    # sans texte) après N jours d'inactivité. 0 = désactivé.
    quarantine_retention_days: int = 7

    # Cache
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 3600

    # Auth JWT
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 12

    # CORS — liste séparée par des virgules dans .env
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    # App
    app_env: str = "development"
    log_level: str = "INFO"
    app_name: str = "Neurones IA"
    app_version: str = "0.1.0"


settings = Settings()
