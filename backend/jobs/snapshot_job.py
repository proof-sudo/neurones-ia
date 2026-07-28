"""Lot 0 du portage maquette Neurones Intelligence — capture quotidienne (jamais
écrasée) de l'état des opportunités et du carnet de commandes.

Odoo n'historise pas nativement stage/probability/expected_revenue/deadline sur
crm.lead (accès à mail.tracking.value refusé, confirmé Phase 1 du portage), et notre
propre synchro écrase l'état précédent à chaque cycle (confirmé Phase 0). Sans cette
capture, tout changement d'état antérieur est perdu DÉFINITIVEMENT — c'est la seule
tâche du projet de portage qualifiée de dommage irréversible en cas de report
(docs/portage/02-architecture.md, décision D4).

Lit le miroir SQLite local déjà synchronisé (OpportunityModel/SaleOrderModel) —
n'appelle jamais Odoo directement : c'est une photographie de ce qu'on a DÉJÀ, pas
une nouvelle synchro.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select

from db.database import AsyncSessionLocal
from db.models import (
    OpportunityModel,
    OpportunitySnapshotModel,
    SaleOrderModel,
    SaleOrderSnapshotModel,
)

logger = logging.getLogger(__name__)


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def run_daily_snapshot(snapshot_date: str | None = None) -> dict:
    """Capture l'état courant des opportunités et du carnet de commandes.

    Idempotent par jour : si rejoué le même jour (ex. misfire retry), les lignes de
    ce jour sont remplacées par l'état courant, pas dupliquées ni cumulées.
    """
    day = snapshot_date or _today_utc()
    captured_at = datetime.utcnow()

    async with AsyncSessionLocal() as session:
        await session.execute(
            delete(OpportunitySnapshotModel).where(OpportunitySnapshotModel.snapshot_date == day)
        )
        opportunities = (await session.execute(select(OpportunityModel))).scalars().all()
        for opp in opportunities:
            session.add(OpportunitySnapshotModel(
                snapshot_date=day,
                opp_id=opp.opp_id,
                odoo_id=opp.odoo_id,
                client_name=opp.client_name,
                stage=opp.stage,
                expected_revenue=opp.expected_revenue,
                probability=opp.probability,
                salesperson_name=opp.salesperson_name,
                deadline=opp.deadline,
                captured_at=captured_at,
            ))
        await session.commit()
        nb_opportunities = len(opportunities)

    async with AsyncSessionLocal() as session:
        await session.execute(
            delete(SaleOrderSnapshotModel).where(SaleOrderSnapshotModel.snapshot_date == day)
        )
        sale_orders = (await session.execute(select(SaleOrderModel))).scalars().all()
        for so in sale_orders:
            session.add(SaleOrderSnapshotModel(
                snapshot_date=day,
                order_id=so.order_id,
                odoo_id=so.odoo_id,
                client_name=so.client_name,
                state=so.state,
                amount=so.amount,
                captured_at=captured_at,
            ))
        await session.commit()
        nb_sale_orders = len(sale_orders)

    logger.info(
        "Snapshot quotidien (Lot 0) du %s : %d opportunités, %d commandes capturées",
        day, nb_opportunities, nb_sale_orders,
    )
    return {"snapshot_date": day, "opportunities": nb_opportunities, "sale_orders": nb_sale_orders}
