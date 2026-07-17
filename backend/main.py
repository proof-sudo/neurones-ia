import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from config.settings import settings
from config.container import Container
from db.database import init_db
from api.v1 import health, chat, presales, stats, crm, webhooks, ged, auth, dashboard, insights
from api.v1.dependencies import get_current_user
from modules.uc_veille.router import router as veille_router

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Démarrage Neurones IA v%s [%s]", settings.app_version, settings.app_env)
    await init_db()
    container = Container()
    await container.startup()
    app.state.container = container
    yield
    logger.info("Arrêt Neurones IA")
    await container.shutdown()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env == "development" else None,
)

_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

# GZip pour toutes les réponses JSON > 1 Ko (exclut SSE — Content-Encoding incompatible)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_auth = [Depends(get_current_user)]

# Endpoints publics (pas de token requis)
app.include_router(health.router, prefix="/v1")
app.include_router(auth.router, prefix="/v1")

# Endpoints protégés
app.include_router(chat.router, prefix="/v1", dependencies=_auth)
app.include_router(presales.router, prefix="/v1", dependencies=_auth)
app.include_router(stats.router, prefix="/v1", dependencies=_auth)
app.include_router(dashboard.router, prefix="/v1", dependencies=_auth)
app.include_router(insights.router, prefix="/v1", dependencies=_auth)
app.include_router(crm.router, prefix="/v1", dependencies=_auth)
app.include_router(ged.router, prefix="/v1", dependencies=_auth)
app.include_router(veille_router, prefix="/v1", dependencies=_auth)

# Webhooks Odoo : protégés par HMAC secret séparé (pas JWT)
app.include_router(webhooks.router, prefix="/v1")
