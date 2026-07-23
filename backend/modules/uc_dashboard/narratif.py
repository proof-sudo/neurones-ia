"""Analyse de la courbe d'évolution du CA affichée dans le cockpit, rédigée
par Claude. Les statistiques de tendance sont déjà calculées en Python à
partir des vrais points de la courbe — Claude ne fait que les commenter et
proposer une recommandation, jamais recalculer. Repli déterministe si Claude
échoue.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# ---------- Analyse de la courbe d'évolution du CA affichée ----------
# Remplace le bouton manuel "Générer une projection" : se déclenche
# automatiquement à chaque changement de période, sur les points RÉELS de la
# courbe affichée (jamais les 2 mois de prévision ajoutés au graphe).

_SYSTEM_TREND = (
    "Tu es directeur commercial d'une ESN ivoirienne (S2I). Tu analyses la "
    "courbe d'évolution du CA commandé affichée dans le cockpit — des points déjà "
    "calculés — en français, de façon concise et factuelle."
)

_USER_TEMPLATE_TREND = """Courbe CA commandé affichée ({nb_mois} mois, de {periode_debut} à {periode_fin}) :
- Valeur en {periode_debut} : {valeur_debut} M FCFA
- Valeur en {periode_fin} : {valeur_fin} M FCFA
- Variation sur la période affichée : {variation_pct}%
- Pic : {mois_pic} ({valeur_pic} M FCFA)
- Creux : {mois_creux} ({valeur_creux} M FCFA)
- Moyenne sur la période affichée : {moyenne_periode} M FCFA

Rédige 2 courts paragraphes (pas de titres, pas de markdown, en français) :
1. La tendance de cette courbe précise (hausse/baisse/stabilité, et son ampleur réelle).
2. Une recommandation concrète cohérente avec cette tendance.
Base-toi UNIQUEMENT sur les chiffres donnés, aucune invention de montant ou de mois."""


def _fallback_trend(ctx: dict) -> str:
    """Repli déterministe sur les vraies données de la courbe affichée."""
    variation = ctx["variation_pct"]
    tendance = "en hausse" if variation > 0 else "en baisse" if variation < 0 else "stable"
    return "\n\n".join([
        f"Le CA commandé est {tendance} entre {ctx['periode_debut']} ({ctx['valeur_debut']} M FCFA) et "
        f"{ctx['periode_fin']} ({ctx['valeur_fin']} M FCFA), soit {variation}% sur la période affichée. "
        f"Le pic se situe en {ctx['mois_pic']} ({ctx['valeur_pic']} M FCFA), le creux en "
        f"{ctx['mois_creux']} ({ctx['valeur_creux']} M FCFA).",
        f"Moyenne sur la période affichée : {ctx['moyenne_periode']} M FCFA — à comparer aux prochains "
        "mois pour confirmer si cette tendance se maintient.",
    ])


async def build_trend_analysis(llm, ctx: dict) -> str:
    """ctx : statistiques de la courbe déjà calculées en Python (jamais recalculées par le LLM)."""
    if llm is None:
        return _fallback_trend(ctx)
    try:
        user = _USER_TEMPLATE_TREND.format(**ctx)
        text = await llm.generate(system=_SYSTEM_TREND, user=user, max_tokens=400, temperature=0.5)
        return (text or "").strip() or _fallback_trend(ctx)
    except Exception as exc:
        logger.warning("Analyse IA tendance CA échouée (repli calculs réels) : %s", exc)
        return _fallback_trend(ctx)
