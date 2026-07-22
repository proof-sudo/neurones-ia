"""Analyse transversale « montée en valeur », rédigée par Claude à partir des
signaux déjà calculés (aggregation.py) — jamais recalculés par le LLM.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Tu es directeur commercial d'une ESN ivoirienne (S2I). Tu commentes des "
    "signaux de montée en valeur (cross-sell, up-sell, renouvellement, "
    "obsolescence) déjà détectés sur les vraies commandes clients, en "
    "français, de façon concise et actionnable."
)

_USER_TEMPLATE = """Signaux détectés sur les commandes réelles :
- Renouvellements à traiter : {nb_renouvellement}
- Catégories obsolètes (>24 mois sans achat) : {nb_obsolete}
- Opportunités de cross-sell (catégorie achetée sans son complément) : {nb_cross_sell}
- Opportunités d'up-sell (client mono-catégorie, dépense significative) : {nb_up_sell}
- Signal le plus important : {top_signal_type} chez {top_signal_client} — {top_signal_montant} M FCFA ({top_signal_detail})

Rédige 2 courts paragraphes (pas de titres, pas de markdown, en français) :
1. Sur quel type de signal concentrer l'énergie commerciale cette semaine, et pourquoi.
2. Une action concrète pour le signal le plus important identifié ci-dessus.
Base-toi UNIQUEMENT sur les chiffres donnés, aucune invention de montant ou de nom."""


def _fallback_analysis(ctx: dict) -> str:
    return "\n\n".join([
        f"{ctx['nb_renouvellement']} renouvellements, {ctx['nb_obsolete']} catégories obsolètes, "
        f"{ctx['nb_cross_sell']} opportunités de cross-sell et {ctx['nb_up_sell']} d'up-sell ont été "
        "détectés sur les commandes réelles du portefeuille.",
        f"Signal prioritaire : {ctx['top_signal_type']} chez {ctx['top_signal_client']} "
        f"({ctx['top_signal_montant']} M FCFA, {ctx['top_signal_detail']}) — à traiter en premier.",
    ])


async def build_crosssell_analysis(llm, ctx: dict) -> str:
    if llm is None:
        return _fallback_analysis(ctx)
    try:
        user = _USER_TEMPLATE.format(**ctx)
        text = await llm.generate(system=_SYSTEM, user=user, max_tokens=400, temperature=0.5)
        return (text or "").strip() or _fallback_analysis(ctx)
    except Exception as exc:
        logger.warning("Analyse IA montée en valeur échouée (repli calculs réels) : %s", exc)
        return _fallback_analysis(ctx)
