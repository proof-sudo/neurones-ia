"""jobs.snapshot_job.run_daily_snapshot — Lot 0 du portage maquette. Odoo n'historise
pas stage/probability/expected_revenue sur crm.lead, et notre propre synchro écrase
l'état précédent à chaque cycle : ce job capture l'état courant AVANT qu'il ne soit
perdu. Utilise une vraie base SQLite temporaire (même patron que
test_supplier_intelligence.py) — la logique lit/écrit sur plusieurs tables."""
import asyncio
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

import jobs.snapshot_job as snapshot_job
from db.database import Base
from db.models import (
    OpportunityModel,
    OpportunitySnapshotModel,
    SaleOrderModel,
    SaleOrderSnapshotModel,
)
from sqlalchemy import select


@pytest.fixture
def db_session_factory(monkeypatch):
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _setup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_setup())
    monkeypatch.setattr(snapshot_job, "AsyncSessionLocal", session_factory)
    return session_factory


def _seed_opportunity(session_factory, *, opp_id="opp_1", stage="Négociation", probability=60.0):
    async def _run():
        async with session_factory() as session:
            session.add(OpportunityModel(
                opp_id=opp_id, odoo_id=1, client_name="Client X", name="Deal X",
                stage=stage, expected_revenue=10_000_000.0, probability=probability,
                salesperson_name="Awa", deadline=datetime.utcnow() + timedelta(days=30),
            ))
            await session.commit()
    asyncio.run(_run())


def _seed_sale_order(session_factory, *, order_id="so_1", state="sale", amount=5_000_000.0):
    async def _run():
        async with session_factory() as session:
            session.add(SaleOrderModel(
                order_id=order_id, odoo_id=1, client_id="1", client_name="Client X",
                name="BC/1", amount=amount, state=state, date_order=datetime.utcnow(),
            ))
            await session.commit()
    asyncio.run(_run())


def test_capture_l_etat_courant_des_opportunites(db_session_factory):
    _seed_opportunity(db_session_factory, stage="Négociation", probability=60.0)

    result = asyncio.run(snapshot_job.run_daily_snapshot(snapshot_date="2026-07-28"))

    assert result == {"snapshot_date": "2026-07-28", "opportunities": 1, "sale_orders": 0}

    async def _check():
        async with db_session_factory() as session:
            rows = (await session.execute(select(OpportunitySnapshotModel))).scalars().all()
            return rows
    rows = asyncio.run(_check())
    assert len(rows) == 1
    assert rows[0].stage == "Négociation"
    assert rows[0].probability == 60.0
    assert rows[0].snapshot_date == "2026-07-28"


def test_capture_le_carnet_de_commandes(db_session_factory):
    _seed_sale_order(db_session_factory, state="sale", amount=5_000_000.0)

    result = asyncio.run(snapshot_job.run_daily_snapshot(snapshot_date="2026-07-28"))

    assert result["sale_orders"] == 1

    async def _check():
        async with db_session_factory() as session:
            rows = (await session.execute(select(SaleOrderSnapshotModel))).scalars().all()
            return rows
    rows = asyncio.run(_check())
    assert len(rows) == 1
    assert rows[0].state == "sale"
    assert rows[0].amount == 5_000_000.0


def test_idempotent_rejoue_le_meme_jour_remplace_sans_dupliquer(db_session_factory):
    _seed_opportunity(db_session_factory, stage="Négociation", probability=60.0)

    asyncio.run(snapshot_job.run_daily_snapshot(snapshot_date="2026-07-28"))

    # L'opportunité progresse dans la même journée (ex. rejeu après un misfire) —
    # le nouveau run doit REMPLACER la ligne du jour, pas en ajouter une deuxième.
    async def _update_stage():
        async with db_session_factory() as session:
            opp = await session.get(OpportunityModel, "opp_1")
            opp.stage = "Signé"
            opp.probability = 100.0
            await session.commit()
    asyncio.run(_update_stage())

    result = asyncio.run(snapshot_job.run_daily_snapshot(snapshot_date="2026-07-28"))
    assert result["opportunities"] == 1

    async def _check():
        async with db_session_factory() as session:
            rows = (await session.execute(select(OpportunitySnapshotModel))).scalars().all()
            return rows
    rows = asyncio.run(_check())
    assert len(rows) == 1  # une seule ligne pour ce jour, pas deux
    assert rows[0].stage == "Signé"  # reflète le dernier état, pas l'ancien


def test_deux_jours_distincts_conservent_chacun_leur_photographie(db_session_factory):
    _seed_opportunity(db_session_factory, stage="Négociation", probability=60.0)
    asyncio.run(snapshot_job.run_daily_snapshot(snapshot_date="2026-07-27"))

    async def _update_stage():
        async with db_session_factory() as session:
            opp = await session.get(OpportunityModel, "opp_1")
            opp.stage = "Signé"
            opp.probability = 100.0
            await session.commit()
    asyncio.run(_update_stage())
    asyncio.run(snapshot_job.run_daily_snapshot(snapshot_date="2026-07-28"))

    async def _check():
        async with db_session_factory() as session:
            rows = (await session.execute(
                select(OpportunitySnapshotModel).order_by(OpportunitySnapshotModel.snapshot_date)
            )).scalars().all()
            return rows
    rows = asyncio.run(_check())
    assert len(rows) == 2  # l'historique des DEUX jours est conservé, jamais écrasé
    assert rows[0].snapshot_date == "2026-07-27" and rows[0].stage == "Négociation"
    assert rows[1].snapshot_date == "2026-07-28" and rows[1].stage == "Signé"
