import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from core.services.ged_indexer import GEDIndexer
from core.ports.crm_repository import CRMRepository

logger = logging.getLogger(__name__)


def build_scheduler(
    ged_indexer: GEDIndexer,
    crm_repo: CRMRepository,
    odoo_sync_interval_hours: int = 2,
) -> AsyncIOScheduler:
    from config.settings import settings
    scheduler = AsyncIOScheduler()

    # Sync Odoo : min 5 min, max 1 instance, coalesce pour éviter pile-up
    sync_interval = max(5, settings.odoo_sync_interval_minutes)
    scheduler.add_job(
        _sync_odoo_job,
        trigger=IntervalTrigger(minutes=sync_interval),
        id="odoo_sync",
        name="Sync Odoo → SQLite local",
        replace_existing=True,
        misfire_grace_time=120,
        coalesce=True,
        max_instances=1,
    )

    scheduler.add_job(
        _scan_ged_job,
        args=[ged_indexer],
        trigger=CronTrigger(hour=2, minute=0),
        id="ged_scan",
        name="Scan GED nocturne",
        replace_existing=True,
        misfire_grace_time=600,
        coalesce=True,
        max_instances=1,
    )

    scheduler.add_job(
        _reset_monthly_budget,
        trigger=CronTrigger(day=1, hour=0, minute=0),
        id="budget_reset",
        name="Reset budget tokens mensuel",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )

    scheduler.add_job(
        _veille_scan_job,
        trigger=IntervalTrigger(hours=6),
        id="veille_scan",
        name="Veille AO automatique",
        replace_existing=True,
        misfire_grace_time=300,
        coalesce=True,
        max_instances=1,
    )

    logger.info(
        "Scheduler configuré : sync Odoo toutes les %d min (coalesce, max 1), scan GED à 2h00, veille AO toutes les 6h",
        sync_interval,
    )
    return scheduler


async def _sync_odoo_job():
    from jobs.odoo_sync_job import run_odoo_sync
    await run_odoo_sync()


async def _scan_ged_job(ged_indexer: GEDIndexer):
    from jobs.ged_scan_job import run_ged_scan
    await run_ged_scan(ged_indexer)


async def _reset_monthly_budget():
    logger.info("Reset budget tokens mensuel")


async def _veille_scan_job():
    from modules.uc_veille.router import _run_scan
    await _run_scan()
