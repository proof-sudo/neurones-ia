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
    embed_fallback_enabled: bool = True      # bascule sur sentence-transformers si OpenAI indisponible
    embed_fallback_model: str = "all-MiniLM-L6-v2"   # modèle local sentence-transformers

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
    max_context_tokens: int = 3000
    # Chunks max conservés par fichier après fusion (dédoublonnage). 1 = un seul chunk/doc
    # (max de diversité) mais un CV multi-pages ne remonte alors que sa page la mieux classée
    # → ses certifs (autre page) sont perdues. 2 = recall des docs multi-pages sans noyer le top-k.
    rag_max_chunks_per_file: int = 2
    # Taille d'extrait conservée par chunk (chars). Un chunk fait ~600 mots (~4000-4500 chars) :
    # un excerpt trop court ampute la FIN du chunk — or les certifications d'un CV y vivent
    # (ex. « ODOO Functional Certification » à l'offset 2657 d'un CV de 3112 chars était coupée à
    # 2500). On dimensionne pour tenir un chunk entier → plus de troncature en plein milieu d'une
    # info décisive. Le budget global reste borné par max_context_tokens dans build_context.
    excerpt_chars: int = 4500
    # Levier ① — plancher de similarité cosinus pour le matching CV (étape 3a). En-dessous,
    # un CV est jugé hors-sujet et écarté, AU LIEU de remplir le quota avec du bruit (un AO Odoo
    # ne doit pas remonter des CV réseau à cosinus ~0.4). 0 = désactivé. Tunable selon l'embedder :
    # text-embedding-3-small discrimine mieux (~0.3-0.7) que le fallback sentence-transformers (~0.4-0.6).
    cv_min_similarity: float = 0.50
    # Levier ③ — re-rank LLM de pertinence par domaine (étape 3a). Après le plancher cosinus,
    # le LLM juge STRICTEMENT si chaque CV correspond à un profil demandé (un CV réseau ≠ besoin
    # dev Odoo) et écarte les hors-sujet que l'embedder seul ne sait pas distinguer. 1 appel/scoring.
    cv_llm_rerank: bool = True
    # Mêmes leviers ①+③ pour les PROJETS similaires (étape 3b, search_diverse) : sans eux, le
    # matching « par type » remonte toujours le top-2 ABE (souvent Cisco/Fortinet) même pour un AO
    # Odoo, et un fallback injecte des docs hors-type/hors-sujet. Floor + re-rank LLM règlent ça.
    project_min_similarity: float = 0.50
    project_llm_rerank: bool = True

    # OCR PDF
    ocr_max_pages: int = 40              # cap pages OCR (perf) — au-delà, WARNING explicite
    ocr_min_chars_per_page: int = 80     # en-dessous, la couche texte est jugée trop maigre → OCR
    # Page avec une image significative (certif/diplôme scanné) ET peu de texte → OCR ciblé,
    # même si la couche texte dépasse ocr_min_chars_per_page (cas du titre « Certifications »
    # suivi d'une image). Évite de perdre les pages-image noyées dans un document textuel.
    ocr_image_page_text_max: int = 600   # plafond texte pour déclencher l'OCR d'une page-image
    ocr_image_area_ratio: float = 0.06   # image couvrant ≥ 6 % de la page = significative
                                         # (sépare nettement logos ~1 % des scans de certifs ~9 %+)

    # Chat
    max_history_turns: int = 6

    # Budget tokens
    token_budget_monthly_fcfa: int = 130_000
    token_alert_threshold_pct: int = 80

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
