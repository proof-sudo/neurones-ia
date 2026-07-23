"""
Endpoints REST agrégés pour le cockpit frontend.

Réutilisent les agrégations du LocalCRMAdapter (les mêmes que celles servies
au copilote comme outils LLM) — aucune logique métier nouvelle ici, juste
l'exposition JSON. Chaque endpoint est gated par vue via require_views()
(matrice config/permissions.py) : la protection est côté serveur, pas un
simple masquage de menu.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from api.v1.dependencies import require_views
from modules.uc_forecast.aggregation import build_pipeline_forecast, month_labels
from modules.uc_forecast.decision_client import build_client_decision
from modules.uc_forecast.narratif import build_forecast_analysis
from modules.uc_dashboard.narratif import build_trend_analysis
from modules.uc_performance.narratif import build_performance_analysis
from modules.uc_tresorerie.decision_recouvrement import build_recouvrement_decision
from modules.uc_tresorerie.narratif import build_tresorerie_analysis

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


def _m_fcfa_dashboard(xof: float) -> int:
    return round((xof or 0) / 1_000_000)


class TrendAnalysisRequest(BaseModel):
    months: list[str]
    values_m_fcfa: list[float]


@router.post("/analysis", dependencies=[Depends(require_views("dashboard"))])
async def dashboard_analysis(request: Request, body: TrendAnalysisRequest):
    """Analyse de la courbe CA réellement affichée (mois/valeurs déjà calculés
    côté client selon le filtre de période actif) — se déclenche automatiquement
    au chargement/changement de période, jamais recalculée par le LLM."""
    months, values = body.months, body.values_m_fcfa
    if not months or not values or all(v == 0 for v in values):
        return {"analysis": "Pas assez de données sur cette période pour une analyse de tendance."}

    debut, fin = values[0], values[-1]
    variation_pct = round((fin - debut) / debut * 100, 1) if debut else 0.0
    pic_idx = max(range(len(values)), key=lambda i: values[i])
    creux_idx = min(range(len(values)), key=lambda i: values[i])

    ctx = {
        "nb_mois": len(values),
        "periode_debut": months[0],
        "periode_fin": months[-1],
        "valeur_debut": round(debut),
        "valeur_fin": round(fin),
        "variation_pct": variation_pct,
        "mois_pic": months[pic_idx],
        "valeur_pic": round(values[pic_idx]),
        "mois_creux": months[creux_idx],
        "valeur_creux": round(values[creux_idx]),
        "moyenne_periode": round(sum(values) / len(values)),
    }
    llm = getattr(request.app.state.container, "llm_sonnet", None)
    analysis = await build_trend_analysis(llm, ctx)
    return {"analysis": analysis, "context": ctx}


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


# ---------- Performance ----------

@router.get("/performance/summary", dependencies=[Depends(require_views("performance"))])
async def performance_summary(request: Request, limit: int = Query(default=20, le=100)):
    """Taux de victoire (historique) + opportunités perdues (top N, par client, par commercial)."""
    crm = _crm(request)
    return {
        "win_rate": await crm.get_win_rate(),
        "lost_deals": await crm.get_lost_deals(limit=limit),
    }


@router.post("/performance/analysis", dependencies=[Depends(require_views("performance"))])
async def performance_analysis(request: Request):
    """Lecture qualitative des performances, rédigée par Claude à partir des
    chiffres réels déjà calculés (jamais recalculés par le LLM)."""
    crm = _crm(request)
    win_rate = await crm.get_win_rate()
    lost = await crm.get_lost_deals(limit=50)
    if lost["nb_total"] == 0:
        return {"analysis": "Aucune opportunité perdue enregistrée — pas d'analyse de pertes possible."}

    top_client = lost["by_client"][0]
    ctx = {
        "taux_nb": win_rate["taux_nb_pct"],
        "taux_valeur": win_rate["taux_valeur_pct"],
        "nb_perdues": lost["nb_total"],
        "montant_perdu": _m_fcfa(lost["montant_total_xof"]),
        "top_client_name": top_client["client"],
        "top_client_montant": _m_fcfa(top_client["montant_xof"]),
        "top_client_nb": top_client["nb"],
    }
    llm = getattr(request.app.state.container, "llm_sonnet", None)
    analysis = await build_performance_analysis(llm, ctx)
    return {"analysis": analysis, "context": ctx}


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


def _m_fcfa(xof: float) -> int:
    return round(xof / 1_000_000)


@router.get("/forecast/pipeline-weighted", dependencies=[Depends(require_views("forecast"))])
async def forecast_pipeline_weighted(request: Request):
    """Forecast pondéré à partir des vraies opportunités ouvertes du pipeline
    (scénarios pessimiste/réaliste/optimiste, répartition mensuelle, par étape,
    par client) — remplace le calcul JS qui tournait sur des fixtures front.
    """
    opportunities = await _crm(request).list_opportunities(limit=500)
    result = build_pipeline_forecast(opportunities)
    result["month_labels"] = month_labels()
    return result


@router.post("/forecast/analysis", dependencies=[Depends(require_views("forecast"))])
async def forecast_analysis(request: Request):
    """Lecture qualitative du forecast pondéré, rédigée par Claude à partir des
    chiffres réels déjà calculés (jamais recalculés par le LLM)."""
    opportunities = await _crm(request).list_opportunities(limit=500)
    agg = build_pipeline_forecast(opportunities)
    scen = agg["scenarios"]
    if scen["nb_opportunites"] == 0 or scen["realiste_xof"] == 0:
        return {"analysis": "Aucune opportunité pondérée dans le pipeline ouvert actuellement — pas de forecast à analyser."}

    top_opp = max(agg["opportunities"], key=lambda o: o["weighted_xof"])
    top_stage = agg["by_stage"][0]
    ctx = {
        "nb_opps": scen["nb_opportunites"],
        "realiste": _m_fcfa(scen["realiste_xof"]),
        "pessimiste": _m_fcfa(scen["pessimiste_xof"]),
        "optimiste": _m_fcfa(scen["optimiste_xof"]),
        "avg_prob": scen["avg_probability_pct"],
        "top_opp_name": top_opp["name"],
        "top_opp_client": top_opp["client"],
        "top_opp_share": round(top_opp["weighted_xof"] / scen["realiste_xof"] * 100),
        "top_stage_name": top_stage["stage"],
        "top_stage_share": round(top_stage["weighted_xof"] / scen["realiste_xof"] * 100),
        "top_stage_value": _m_fcfa(top_stage["weighted_xof"]),
        "ecart": _m_fcfa(scen["optimiste_xof"] - scen["pessimiste_xof"]),
    }
    llm = getattr(request.app.state.container, "llm_sonnet", None)
    analysis = await build_forecast_analysis(llm, ctx)
    return {"analysis": analysis, "context": ctx}


class ClientDecisionRequest(BaseModel):
    client: str


@router.post("/forecast/client-decision", dependencies=[Depends(require_views("forecast"))])
async def forecast_client_decision(request: Request, body: ClientDecisionRequest):
    """Décision recommandée pour un client du forecast : risque calculé en
    Python (impayé connu + opportunité à échéance dépassée), Claude rédige
    uniquement la justification et l'action."""
    crm = _crm(request)
    opportunities = await crm.list_opportunities(limit=500)
    agg = build_pipeline_forecast(opportunities)
    client_agg = next((c for c in agg["by_client"] if c["client"] == body.client), None)
    if client_agg is None:
        raise HTTPException(status_code=404, detail="Client introuvable dans le pipeline ouvert")

    exposure = await crm.get_unpaid_exposure()
    debiteur = next(
        (d for d in exposure["top_10_debiteurs"] if d["client"] == body.client), None
    )
    opp_risque = next((o for o in client_agg["opportunities"] if o["at_risk"]), None)

    llm = getattr(request.app.state.container, "llm_haiku", None)
    decision = await build_client_decision(
        llm,
        client=body.client,
        pondere_xof=client_agg["weighted_xof"],
        debiteur=debiteur,
        opp_risque=opp_risque,
    )
    return decision


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


@router.post("/unpaid/analysis", dependencies=[Depends(require_views("tresorerie"))])
async def unpaid_analysis(request: Request):
    """Lecture qualitative de l'exposition aux impayés, rédigée par Claude à
    partir des chiffres réels déjà calculés (jamais recalculés par le LLM)."""
    exposure = await _crm(request).get_unpaid_exposure()
    if exposure["nb_factures_impayees"] == 0:
        return {"analysis": "Aucun impayé enregistré actuellement."}

    top3 = exposure["top_10_debiteurs"][:3]
    top1 = top3[0] if top3 else None
    ctx = {
        "exposition_totale": _m_fcfa(exposure["exposition_totale_xof"]),
        "nb_factures": exposure["nb_factures_impayees"],
        "retard_90j_montant": _m_fcfa(exposure["retard_90j_montant_xof"]),
        "retard_90j_nb": exposure["retard_90j_nb_factures"],
        "top_debiteur_client": top1["client"] if top1 else "—",
        "top_debiteur_montant": _m_fcfa(top1["montant_total_xof"]) if top1 else 0,
        "top_debiteur_jours": top1["retard_max_jours"] if top1 else 0,
        "top3_part_pct": (
            round(sum(d["montant_total_xof"] for d in top3) / exposure["exposition_totale_xof"] * 100)
            if exposure["exposition_totale_xof"] else 0
        ),
    }
    llm = getattr(request.app.state.container, "llm_sonnet", None)
    analysis = await build_tresorerie_analysis(llm, ctx)
    return {"analysis": analysis, "context": ctx}


class RecouvrementDecisionRequest(BaseModel):
    client: str


@router.post("/unpaid/recouvrement-decision", dependencies=[Depends(require_views("tresorerie"))])
async def unpaid_recouvrement_decision(request: Request, body: RecouvrementDecisionRequest):
    """Décision de recouvrement pour un débiteur : urgence calculée en Python
    (retard réel), Claude rédige uniquement la justification et l'action."""
    exposure = await _crm(request).get_unpaid_exposure()
    debiteur = next((d for d in exposure["top_10_debiteurs"] if d["client"] == body.client), None)
    if debiteur is None:
        raise HTTPException(status_code=404, detail="Client introuvable dans les impayés")

    llm = getattr(request.app.state.container, "llm_haiku", None)
    decision = await build_recouvrement_decision(
        llm,
        client=body.client,
        montant_xof=debiteur["montant_total_xof"],
        jours=debiteur["retard_max_jours"],
    )
    return decision


# ---------- Leads ----------

@router.get("/leads", dependencies=[Depends(require_views("leads"))])
async def hot_leads(request: Request, limit: int = Query(default=10, le=50)):
    return await _crm(request).get_hot_leads(limit=limit)
