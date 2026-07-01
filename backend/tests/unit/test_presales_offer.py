"""Offre à fort impact (UC10) : contexte enrichi + parse tolérant + garde-fou qualité."""
from core.domain.offer import ScoringResult, ExtractedItem, Risk, BidRecommendation
from modules.uc10_presales.offer_generator import (
    _offer_user_context, _loads_offer_json, _offer_quality_warnings,
)


def _scoring(**kw) -> ScoringResult:
    base = dict(
        ao_filename="ao.pdf", summary="Refonte du SI bancaire", key_elements=[],
        matched_documents=[], gaps_analysis="Pas de référence BI récente", strengths=[],
        risks=[], score=62, recommendation=BidRecommendation.GO, justification="",
    )
    base.update(kw)
    return ScoringResult(**base)


def test_loads_valid_json():
    raw = '{"titre_projet": "Déploiement Odoo", "fonctionnalites": ["A", "B"]}'
    data = _loads_offer_json(raw)
    assert data["titre_projet"] == "Déploiement Odoo"
    assert data["fonctionnalites"] == ["A", "B"]


def test_loads_tronque_recupere_la_prose():
    # JSON coupé en plein milieu d'un module : les blocs de prose déjà fermés doivent survivre.
    raw = (
        '{"titre_projet": "Mise en place d\'une plateforme bancaire",'
        ' "expression_besoins": ["§1 contexte BGFI secteur bancaire.",'
        ' "§2 besoins fonctionnels précis.", "§3 objectifs attendus."],'
        ' "objectifs_reponse": ["obj A", "obj B"],'
        ' "modules": [{"titre": "Module 1 — Gestion'  # ← tronqué ici
    )
    data = _loads_offer_json(raw)
    assert data["titre_projet"].startswith("Mise en place")
    assert len(data["expression_besoins"]) == 3
    assert data["objectifs_reponse"] == ["obj A", "obj B"]
    assert "modules" not in data  # bloc tronqué non récupéré → retombera sur le défaut


def test_loads_garbage_renvoie_vide_et_qualite_alerte():
    data = _loads_offer_json("ceci n'est pas du JSON du tout")
    assert data == {}
    warnings = _offer_quality_warnings(data)
    assert warnings and "illisible" in warnings[0].lower()


def test_quality_signale_les_sections_manquantes():
    data = {"titre_projet": "X", "expression_besoins": ["a"], "objectifs_reponse": ["b"],
            "presentation_reponse": ["c"], "fonctionnalites": ["d"], "stack_technique": [{}]}
    warnings = _offer_quality_warnings(data)
    assert any("modules" in w for w in warnings)  # modules absent → signalé


def test_contexte_enrichi_contient_atouts_et_risques():
    sc = _scoring(
        strengths=["Expertise Odoo multi-sociétés confirmée"],
        risks=[Risk(label="Absence de référence BI", criticite="ÉLEVÉ", mitigation="Partenariat BI")],
        besoins=[ExtractedItem("Migration des données comptables")],
    )
    ctx = _offer_user_context(sc, "BGFI", "Digitalisation", "30 jours", "10M FCFA")
    assert "Expertise Odoo multi-sociétés confirmée" in ctx
    assert "ATOUTS" in ctx and "RISQUES" in ctx
    assert "Partenariat BI" in ctx
    assert "BGFI" in ctx
