"""Analyse qualitative de l'exposition aux impayés par Claude.

Les chiffres viennent de CRMRepository.get_unpaid_exposure() (SQL réel sur la
table invoices) — Claude ne fait que les commenter, jamais les recalculer.
Repli déterministe si Claude échoue.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Tu es directeur financier d'une ESN ivoirienne (S2I). Tu commentes une "
    "exposition aux impayés déjà calculée, en français, de façon concise et factuelle."
)

_USER_TEMPLATE = """Chiffres réels de l'exposition aux impayés :
- Exposition totale : {exposition_totale} M FCFA sur {nb_factures} factures impayées
- Retard de plus de 90 jours : {retard_90j_montant} M FCFA sur {retard_90j_nb} factures
- Plus gros débiteur : {top_debiteur_client}, {top_debiteur_montant} M FCFA ({top_debiteur_jours} jours de retard)
- Les 3 plus gros débiteurs concentrent {top3_part_pct}% de l'exposition totale

Rédige 2 courts paragraphes (pas de titres, pas de markdown, en français) :
1. Le niveau de concentration du risque (sur combien de clients repose l'essentiel de l'exposition).
2. La sévérité du plus gros débiteur et ce que cela implique pour la trésorerie.
Base-toi UNIQUEMENT sur les chiffres donnés, aucune invention de montant ou de nom."""


def _fallback_analysis(ctx: dict) -> str:
    """Repli déterministe sur les vraies données."""
    return "\n\n".join([
        f"L'exposition totale aux impayés ({ctx['exposition_totale']} M FCFA sur "
        f"{ctx['nb_factures']} factures) est concentrée : les 3 plus gros débiteurs représentent à "
        f"eux seuls {ctx['top3_part_pct']}% du total.",
        f"Le débiteur le plus critique est {ctx['top_debiteur_client']} avec "
        f"{ctx['top_debiteur_montant']} M FCFA en retard depuis {ctx['top_debiteur_jours']} jours — "
        f"{ctx['retard_90j_montant']} M FCFA sont en retard de plus de 90 jours sur "
        f"{ctx['retard_90j_nb']} factures au total.",
    ])


async def build_tresorerie_analysis(llm, ctx: dict) -> str:
    """ctx : faits déjà calculés (jamais recalculés par le LLM)."""
    if llm is None:
        return _fallback_analysis(ctx)
    try:
        user = _USER_TEMPLATE.format(**ctx)
        text = await llm.generate(system=_SYSTEM, user=user, max_tokens=400, temperature=0.5)
        return (text or "").strip() or _fallback_analysis(ctx)
    except Exception as exc:
        logger.warning("Analyse IA trésorerie échouée (repli calculs réels) : %s", exc)
        return _fallback_analysis(ctx)
