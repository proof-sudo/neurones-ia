"""Analyse qualitative des performances commerciales par Claude.

Les chiffres (taux de victoire, pertes) sont déjà calculés en Python à partir
des vraies opportunités (get_win_rate / get_lost_deals) — Claude ne fait que
les commenter, jamais les recalculer. Repli déterministe si Claude échoue.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Tu es directeur commercial d'une ESN ivoirienne (S2I). Tu commentes des "
    "statistiques de performance commerciale déjà calculées, en français, de "
    "façon concise et factuelle."
)

_USER_TEMPLATE = """Chiffres réels de performance commerciale (historique complet) :
- Taux de victoire en nombre d'opportunités : {taux_nb}%
- Taux de victoire en valeur : {taux_valeur}%
- Opportunités perdues : {nb_perdues}, pour {montant_perdu} M FCFA au total
- Client concentrant le plus de pertes : {top_client_name}, {top_client_montant} M FCFA sur {top_client_nb} opportunités

Rédige 2 courts paragraphes (pas de titres, pas de markdown, en français) :
1. Ce que l'écart entre taux de victoire en nombre et en valeur révèle (dossiers perdus
   structurellement plus gros ou plus petits que les dossiers gagnés).
2. Sur quel client concentrer une revue de compte en priorité, et pourquoi.
Base-toi UNIQUEMENT sur les chiffres donnés, aucune invention de montant ou de nom."""


def _fallback_analysis(ctx: dict) -> str:
    """Repli déterministe : mêmes constats que l'ancien template JS, sur les vraies données."""
    ecart = ctx["taux_nb"] - ctx["taux_valeur"]
    tendance = "plus gros" if ecart > 0 else "plus petits"
    return "\n\n".join([
        f"Le taux de victoire en nombre ({ctx['taux_nb']}%) et en valeur ({ctx['taux_valeur']}%) "
        f"diffèrent nettement : les dossiers perdus sont structurellement {tendance} que les "
        "dossiers gagnés.",
        f"{ctx['top_client_name']} concentre le plus haut montant perdu "
        f"({ctx['top_client_montant']} M FCFA sur {ctx['top_client_nb']} opportunités) — largement "
        "devant tout autre client du portefeuille, à prioriser pour une revue de compte dédiée.",
    ])


async def build_performance_analysis(llm, ctx: dict) -> str:
    """ctx : faits déjà calculés (jamais recalculés par le LLM)."""
    if llm is None:
        return _fallback_analysis(ctx)
    try:
        user = _USER_TEMPLATE.format(**ctx)
        text = await llm.generate(system=_SYSTEM, user=user, max_tokens=400, temperature=0.5)
        return (text or "").strip() or _fallback_analysis(ctx)
    except Exception as exc:
        logger.warning("Analyse IA performance échouée (repli calculs réels) : %s", exc)
        return _fallback_analysis(ctx)
