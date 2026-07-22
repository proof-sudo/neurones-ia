"""Projection & recommandation du tableau de bord, rédigées par Claude.

Les chiffres (CA vs N-1, pipeline pondéré, taux de transformation, marge) sont
déjà calculés en Python à partir des vraies agrégations CRM — Claude ne fait
que les commenter et proposer une recommandation, jamais recalculer. Repli
déterministe si Claude échoue.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Tu es directeur commercial d'une ESN ivoirienne (S2I). Tu commentes les "
    "indicateurs de pilotage déjà calculés du cockpit, en français, de façon "
    "concise et factuelle, et tu proposes une recommandation concrète pour la "
    "journée."
)

_USER_TEMPLATE = """Chiffres réels du cockpit ({annee}) :
- CA commandé {annee} : {ca_annee} M FCFA ({ecart_pct:+.1f}% vs {annee_precedente})
- Pipeline ouvert pondéré : {pipeline_pondere} M FCFA ({nb_opportunites} opportunités)
- Taux de transformation : {taux_victoire_nb}% en nombre, {taux_victoire_valeur}% en valeur
- Marge définitive moyenne : {marge_definitive}%

Rédige 2 courts paragraphes (pas de titres, pas de markdown, en français) :
1. Une projection de la trajectoire à venir basée sur le pipeline pondéré réel et la
   tendance CA vs l'année précédente.
2. Une recommandation concrète pour la journée, cohérente avec ces chiffres.
Base-toi UNIQUEMENT sur les chiffres donnés, aucune invention de montant."""


def _fallback_analysis(ctx: dict) -> str:
    """Repli déterministe sur les vraies données."""
    tendance = "en avance" if ctx["ecart_pct"] >= 0 else "en retrait"
    return "\n\n".join([
        f"Le CA {ctx['annee']} ({ctx['ca_annee']} M FCFA) est {tendance} de "
        f"{abs(ctx['ecart_pct']):.1f}% par rapport à {ctx['annee_precedente']}. Le pipeline "
        f"ouvert pondéré ({ctx['pipeline_pondere']} M FCFA sur {ctx['nb_opportunites']} "
        f"opportunités) reste le principal levier de la trajectoire à venir.",
        f"Taux de transformation : {ctx['taux_victoire_nb']}% en nombre mais "
        f"{ctx['taux_victoire_valeur']}% en valeur, pour une marge définitive moyenne de "
        f"{ctx['marge_definitive']}% — concentrer les efforts sur les opportunités les plus "
        "avancées du pipeline pour sécuriser le CA à venir.",
    ])


async def build_dashboard_analysis(llm, ctx: dict) -> str:
    """ctx : faits déjà calculés (jamais recalculés par le LLM)."""
    if llm is None:
        return _fallback_analysis(ctx)
    try:
        user = _USER_TEMPLATE.format(**ctx)
        text = await llm.generate(system=_SYSTEM, user=user, max_tokens=450, temperature=0.5)
        return (text or "").strip() or _fallback_analysis(ctx)
    except Exception as exc:
        logger.warning("Analyse IA dashboard échouée (repli calculs réels) : %s", exc)
        return _fallback_analysis(ctx)
