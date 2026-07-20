"""
Endpoints REST agrégés pour le cockpit frontend.

Réutilisent les agrégations du LocalCRMAdapter (les mêmes que celles servies
au copilote comme outils LLM) — aucune logique métier nouvelle ici, juste
l'exposition JSON. Chaque endpoint est gated par vue via require_views()
(matrice config/permissions.py) : la protection est côté serveur, pas un
simple masquage de menu.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from api.v1.dependencies import require_views

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _crm(request: Request):
    return request.app.state.container.crm_repo


# ---------- Vue Tableau de bord ----------

@router.get("/kpis", dependencies=[Depends(require_views("dashboard"))])
async def kpis(
    request: Request,
    year: int | None = Query(default=None),
):
    """Bloc complet du cockpit : CA annuel N/N-1 + séries mensuelles N/N-1
    (les filtres période du front se calculent client-side, comme le mockup),
    pipeline OUVERT (stades normalisés), taux de transformation réel, marges.
    """
    crm = _crm(request)
    y = year or datetime.now().year
    current = await crm.get_year_stats(y)
    previous = await crm.get_year_stats(y - 1)
    monthly = await crm.get_monthly_revenue(y)
    monthly_previous = await crm.get_monthly_revenue(y - 1)
    open_pipeline = await crm.get_open_pipeline_stats()
    win_rate = await crm.get_win_rate()
    margins = await crm.get_margin_stats()
    return {
        "year": current,
        "previous_year": previous,
        "monthly": monthly,
        "monthly_previous": monthly_previous,
        "open_pipeline": open_pipeline,
        "win_rate": win_rate,
        "marges": {
            "nb_dossiers": margins["nb_dossiers"],
            "perc_marge_provisoire_moyen": margins["perc_marge_provisoire_moyen"],
            "perc_marge_definitive_moyen": margins["perc_marge_definitive_moyen"],
            "backlog_total": margins["backlog_total"],
            "reste_a_encaisser": margins["reste_a_encaisser"],
            "total_encaisse": margins["total_encaisse"],
            "ca_definitif_total": margins["ca_definitif_total"],
            "marge_definitive_total": margins["marge_definitive_total"],
            "fournisseurs_restant": margins["fournisseurs_restant"],
        },
    }


@router.get("/clients-by-country", dependencies=[Depends(require_views("dashboard"))])
async def clients_by_country(request: Request):
    """Répartition des clients par pays (doughnut du cockpit)."""
    return await _crm(request).get_clients_by_country()


@router.get("/monthly-revenue", dependencies=[Depends(require_views("dashboard"))])
async def monthly_revenue(request: Request, year: int | None = Query(default=None)):
    """Série CA commandé par mois (graphe d'évolution)."""
    y = year or datetime.now().year
    return {"year": y, "months": await _crm(request).get_monthly_revenue(y)}


@router.get("/revenue/by-salesperson", dependencies=[Depends(require_views("dashboard", "performance"))])
async def revenue_by_salesperson(
    request: Request,
    year: int | None = Query(default=None),
    quarter: int | None = Query(default=None, ge=1, le=4),
):
    return await _crm(request).get_revenue_by_salesperson(year=year, quarter=quarter)


@router.get("/revenue/by-sector", dependencies=[Depends(require_views("dashboard"))])
async def revenue_by_sector(
    request: Request,
    year: int | None = Query(default=None),
    limit: int = Query(default=20, le=100),
):
    return await _crm(request).get_revenue_by_sector(year=year, limit=limit)


@router.get("/revenue/by-product", dependencies=[Depends(require_views("catalogue", "dashboard"))])
async def revenue_by_product(
    request: Request,
    year: int | None = Query(default=None),
    limit: int = Query(default=30, le=100),
):
    return await _crm(request).get_revenue_by_product(year=year, limit=limit)


@router.get("/top-clients", dependencies=[Depends(require_views("dashboard", "clients"))])
async def top_clients(
    request: Request,
    year: int | None = Query(default=None),
    limit: int = Query(default=10, le=50),
):
    return await _crm(request).get_top_clients(limit=limit, year=year)


# ---------- Pipeline ----------

@router.get("/pipeline", dependencies=[Depends(require_views("dashboard", "pipeline"))])
async def pipeline_stats(request: Request):
    return await _crm(request).get_pipeline_stats()


@router.get("/pipeline/opportunities", dependencies=[Depends(require_views("pipeline"))])
async def pipeline_opportunities(
    request: Request,
    stage: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    return await _crm(request).list_opportunities(stage=stage, limit=limit)


# ---------- Forecast ----------

@router.get("/forecast", dependencies=[Depends(require_views("forecast"))])
async def forecast(request: Request, year: int | None = Query(default=None)):
    return await _crm(request).get_quarterly_forecast(year=year)


# ---------- Marges / coûts ----------

@router.get("/margins", dependencies=[Depends(require_views("dashboard", "couts"))])
async def margins(
    request: Request,
    year: int | None = Query(default=None),
    limit: int = Query(default=10, le=50),
):
    crm = _crm(request)
    return {
        "stats": await crm.get_margin_stats(year=year),
        "top_dossiers": await crm.get_top_margin_dossiers(limit=limit, year=year),
    }


# ---------- Trésorerie (rôles finance uniquement) ----------

@router.get("/unpaid", dependencies=[Depends(require_views("tresorerie"))])
async def unpaid(request: Request, limit: int = Query(default=10, le=50)):
    """Exposition aux impayés — réservé aux profils avec accès Trésorerie."""
    crm = _crm(request)
    return {
        "exposure": await crm.get_unpaid_exposure(),
        "top_invoices": await crm.get_unpaid_invoices(limit=limit),
    }


# ---------- Leads ----------

@router.get("/leads", dependencies=[Depends(require_views("leads"))])
async def hot_leads(request: Request, limit: int = Query(default=10, le=50)):
    return await _crm(request).get_hot_leads(limit=limit)
