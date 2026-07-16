import logging

from sqlalchemy import event, inspect
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config.settings import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.local_db_path}",
    echo=False,  # Jamais True — coût +3-10ms/requête + saturation logs
    connect_args={"timeout": 30, "check_same_thread": False},
)


@event.listens_for(engine.sync_engine, "connect")
def _enable_sqlite_pragmas(dbapi_conn, _):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")       # Concurrent reads + non-blocking writes
    cur.execute("PRAGMA synchronous=NORMAL")      # Sécurité raisonnable, 3x plus rapide que FULL
    cur.execute("PRAGMA cache_size=-64000")       # 64 MB de cache page
    cur.execute("PRAGMA busy_timeout=30000")      # Attendre 30s avant SQLITE_BUSY
    cur.execute("PRAGMA temp_store=MEMORY")       # Tri/agrégats en mémoire
    cur.execute("PRAGMA mmap_size=134217728")     # 128 MB memory-mapped I/O
    cur.close()


AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    settings.local_db_path.parent.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_veille_entries)


# Colonnes IA S2I ajoutées après coup au Watch-Tracker. `create_all` ne modifie
# jamais une table existante → on ajoute les colonnes manquantes à la main, de
# façon idempotente (aucun effet si la base est déjà à jour ou fraîchement créée).
_VEILLE_ENTRY_NEW_COLUMNS = {
    "ai_analyzed": "BOOLEAN NOT NULL DEFAULT 0",
    "signal_label": "VARCHAR(255) NOT NULL DEFAULT ''",
    "risque": "VARCHAR(500) NOT NULL DEFAULT ''",
    "offre": "VARCHAR(500) NOT NULL DEFAULT ''",
    "offre_short": "VARCHAR(100) NOT NULL DEFAULT ''",
    "priority": "VARCHAR(20) NOT NULL DEFAULT ''",
    "criticite": "INTEGER NOT NULL DEFAULT 0",
    "organisation": "VARCHAR(255) NOT NULL DEFAULT ''",
    "justification": "VARCHAR(1000) NOT NULL DEFAULT ''",
    "origin": "VARCHAR(20) NOT NULL DEFAULT 'source'",
    "debrief": "TEXT NOT NULL DEFAULT ''",
}


def _migrate_veille_entries(sync_conn):
    inspector = inspect(sync_conn)
    if "veille_entries" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("veille_entries")}
    for name, ddl in _VEILLE_ENTRY_NEW_COLUMNS.items():
        if name not in existing:
            sync_conn.exec_driver_sql(
                f"ALTER TABLE veille_entries ADD COLUMN {name} {ddl}"
            )
            logger.info("Migration veille_entries : colonne '%s' ajoutée", name)


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
