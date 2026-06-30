from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config.settings import settings


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


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
