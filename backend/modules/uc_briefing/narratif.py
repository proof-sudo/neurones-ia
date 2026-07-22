"""Rédaction du briefing quotidien par Claude, à partir des faits déjà calculés
par facts.py (jamais recalculés ni inventés par le LLM). Repli déterministe
(les faits bruts, en liste) si Claude échoue — jamais de briefing vide.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

ROLE_LABELS = {
    "dg": "la Direction Générale",
    "dir_commercial": "la Direction Commerciale",
    "dir_financier": "la Direction Financière",
    "dir_operations": "la Direction des Opérations",
    "commercial": "un commercial du terrain",
}

_SYSTEM_TEMPLATE = (
    "Tu es l'assistant de direction d'une ESN ivoirienne (S2I). Tu rédiges le "
    "briefing quotidien pour {role_label}, en français, à partir de faits déjà "
    "calculés et vérifiés — jamais inventés, jamais recalculés. Rédige 3 à 4 "
    "phrases : ce qui compte aujourd'hui, un point de vigilance, une "
    "recommandation concrète pour la journée. Pas de titres, pas de markdown."
)


def _fallback_analysis(bullets: list[str]) -> str:
    """Repli déterministe : les faits bruts, sans mise en récit (IA hors ligne)."""
    return " ".join(bullets)


async def build_daily_analysis(llm, role: str, bullets: list[str]) -> str:
    if not bullets:
        return "Pas assez de données pour un briefing aujourd'hui."
    if llm is None:
        return _fallback_analysis(bullets)
    try:
        role_label = ROLE_LABELS.get(role, role)
        system = _SYSTEM_TEMPLATE.format(role_label=role_label)
        user = "Faits du jour :\n- " + "\n- ".join(bullets) + "\n\nRédige le briefing."
        text = await llm.generate(system=system, user=user, max_tokens=350, temperature=0.5)
        return (text or "").strip() or _fallback_analysis(bullets)
    except Exception as exc:
        logger.warning("Briefing IA échoué pour le rôle '%s' (repli faits bruts) : %s", role, exc)
        return _fallback_analysis(bullets)
