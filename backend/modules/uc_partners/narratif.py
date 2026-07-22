"""Analyse fournisseurs rédigée par Claude, à partir des vrais agrégats
(purchase_orders) — jamais recalculés par le LLM. Repli déterministe si Claude
échoue.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Tu es directeur des opérations d'une ESN ivoirienne (S2I). Tu commentes "
    "l'exposition aux fournisseurs déjà calculée sur les vraies commandes "
    "d'achat, en français, de façon concise et factuelle."
)

_USER_TEMPLATE = """Chiffres réels des commandes fournisseurs :
- Montant total commandé (tous fournisseurs) : {total_m} M FCFA sur {nb_fournisseurs} fournisseurs
- Plus gros fournisseur : {top_nom}, {top_montant_m} M FCFA ({top_part_pct}% du total), {top_nb_commandes} commandes
- Dernière commande chez {top_nom} : {top_derniere_commande}

Rédige 2 courts paragraphes (pas de titres, pas de markdown, en français) :
1. Le niveau de concentration du risque fournisseur (sur combien de fournisseurs repose l'essentiel des achats).
2. Une recommandation concrète sur la relation avec le fournisseur le plus important.
Base-toi UNIQUEMENT sur les chiffres donnés, aucune invention de montant ou de nom."""


def _fallback_analysis(ctx: dict) -> str:
    return "\n\n".join([
        f"Le montant total commandé ({ctx['total_m']} M FCFA sur {ctx['nb_fournisseurs']} fournisseurs) "
        f"est concentré : {ctx['top_nom']} représente à lui seul {ctx['top_part_pct']}% du total "
        f"({ctx['top_montant_m']} M FCFA sur {ctx['top_nb_commandes']} commandes).",
        f"Dernière commande chez {ctx['top_nom']} : {ctx['top_derniere_commande']} — sécuriser cette "
        "relation d'approvisionnement en priorité, vu son poids dans le total commandé.",
    ])


async def build_partners_analysis(llm, ctx: dict) -> str:
    if llm is None:
        return _fallback_analysis(ctx)
    try:
        user = _USER_TEMPLATE.format(**ctx)
        text = await llm.generate(system=_SYSTEM, user=user, max_tokens=400, temperature=0.5)
        return (text or "").strip() or _fallback_analysis(ctx)
    except Exception as exc:
        logger.warning("Analyse IA fournisseurs échouée (repli calculs réels) : %s", exc)
        return _fallback_analysis(ctx)
