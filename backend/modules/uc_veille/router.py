import logging
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select, desc

from db.database import AsyncSessionLocal
from db.models import VeilleSourceModel, VeilleEntryModel
from modules.uc_veille.schemas import (
    VeilleSourceCreate, VeilleSourceOut, VeilleEntryOut, VeilleEntryPatch,
)
from modules.uc_veille.scanner import scan_rss_feed, scan_html_page, DEMO_SOURCES
from api.v1.dependencies import CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/veille", tags=["Veille AO"])


@router.get("/feed", response_model=list[VeilleEntryOut])
async def get_feed(current_user: CurrentUser, limit: int = 50, status: str = ""):
    async with AsyncSessionLocal() as session:
        q = select(VeilleEntryModel).order_by(desc(VeilleEntryModel.detected_at)).limit(limit)
        if status:
            q = q.where(VeilleEntryModel.status == status)
        result = await session.execute(q)
        return result.scalars().all()


@router.get("/stats")
async def get_stats(current_user: CurrentUser):
    async with AsyncSessionLocal() as session:
        total = (await session.execute(select(VeilleEntryModel))).scalars().all()
        new_count = sum(1 for e in total if e.status == "new")
        return {"total": len(total), "new": new_count}


@router.get("/sources", response_model=list[VeilleSourceOut])
async def get_sources(current_user: CurrentUser):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(VeilleSourceModel).order_by(VeilleSourceModel.id))
        return result.scalars().all()


@router.post("/sources", response_model=VeilleSourceOut)
async def add_source(body: VeilleSourceCreate, current_user: CurrentUser):
    async with AsyncSessionLocal() as session:
        src = VeilleSourceModel(**body.model_dump())
        session.add(src)
        await session.commit()
        await session.refresh(src)
        return src


@router.delete("/sources/{source_id}")
async def delete_source(source_id: int, current_user: CurrentUser):
    async with AsyncSessionLocal() as session:
        src = await session.get(VeilleSourceModel, source_id)
        if not src:
            raise HTTPException(404, "Source introuvable")
        await session.delete(src)
        await session.commit()
    return {"ok": True}


@router.patch("/entries/{entry_id}", response_model=VeilleEntryOut)
async def patch_entry(entry_id: int, body: VeilleEntryPatch, current_user: CurrentUser):
    async with AsyncSessionLocal() as session:
        entry = await session.get(VeilleEntryModel, entry_id)
        if not entry:
            raise HTTPException(404, "Entrée introuvable")
        if body.status:
            entry.status = body.status
        await session.commit()
        await session.refresh(entry)
        return entry


@router.post("/scan")
async def manual_scan(request: Request, current_user: CurrentUser):
    """Déclenche un scan manuel de toutes les sources actives."""
    container = request.app.state.container
    await _run_scan(container)
    return {"ok": True, "message": "Scan terminé"}


@router.post("/init-demo")
async def init_demo_sources(current_user: CurrentUser):
    """Initialise les sources démo si aucune n'existe."""
    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(VeilleSourceModel))
        if existing.scalars().first():
            return {"ok": True, "message": "Sources déjà configurées"}
        for src_data in DEMO_SOURCES:
            session.add(VeilleSourceModel(**src_data))
        await session.commit()
    return {"ok": True, "message": f"{len(DEMO_SOURCES)} sources démo ajoutées"}


async def _run_scan(container=None):
    """Scanne toutes les sources actives et insère les nouvelles entrées."""
    async with AsyncSessionLocal() as session:
        sources_result = await session.execute(
            select(VeilleSourceModel).where(VeilleSourceModel.active == True)
        )
        sources = sources_result.scalars().all()

    for source in sources:
        logger.info(f"Scan veille : {source.name}")
        if source.feed_type == "rss":
            entries = await scan_rss_feed(source.url, source.keywords)
        else:
            entries = await scan_html_page(source.url, source.keywords)

        async with AsyncSessionLocal() as session:
            for e in entries:
                # Évite les doublons par URL
                if e["url"]:
                    existing = await session.execute(
                        select(VeilleEntryModel).where(VeilleEntryModel.url == e["url"])
                    )
                    if existing.scalar_one_or_none():
                        continue
                # Évite les doublons par titre si pas d'URL
                elif e["title"]:
                    existing = await session.execute(
                        select(VeilleEntryModel).where(VeilleEntryModel.title == e["title"])
                    )
                    if existing.scalar_one_or_none():
                        continue

                entry = VeilleEntryModel(source_id=source.id, **e)
                session.add(entry)

            # Mettre à jour la date de scan
            src_obj = await session.get(VeilleSourceModel, source.id)
            if src_obj:
                src_obj.last_scan = datetime.utcnow()
            await session.commit()

        logger.info(f"Scan {source.name} terminé : {len(entries)} entrées trouvées")
