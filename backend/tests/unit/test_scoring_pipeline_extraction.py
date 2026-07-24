"""ScoringPipeline — retry sur troncature (step1.extract) et repli grille dégénérée
(step1b.frame). Bug réel trouvé en testant un AO dense (97 pages) : le JSON tronqué
faisait perdre TOUS les besoins/critères en silence, et une grille extraite mais sans
le moindre point chiffré n'était jamais remplacée par le repli standard."""
import asyncio

from core.domain.offer import ScoringCriterion
from core.ports.llm_gateway import OutputTruncatedError
from modules.uc10_presales.scoring_pipeline import ScoringPipeline

# `data/scoring_grids/regie_it.yaml` n'est pas versionné (data/ est dans .gitignore/
# .dockerignore) — absent de cet environnement de test. On fournit une grille standard
# synthétique équivalente plutôt que de dépendre d'un fichier externe non garanti présent.
_FAKE_STANDARD_GRID = [
    ScoringCriterion(id="std-1", label="Expérience", max_points=30, category="Technique", is_inferred=True),
    ScoringCriterion(id="std-2", label="Prix", max_points=40, category="Financier", is_inferred=True),
    ScoringCriterion(id="std-3", label="Méthodologie", max_points=30, category="Technique", is_inferred=True),
]


class FakeLLM:
    """`extract`/`generate` rejouent une séquence de réponses programmées (succès ou
    troncature) — permet de simuler un premier essai tronqué puis un retry réussi."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0
        self.max_tokens_seen = []

    async def extract(self, prompt, text, max_tokens=512, raise_on_truncation=False, temperature=None):
        self.max_tokens_seen.append(max_tokens)
        outcome = self._responses[min(self.calls, len(self._responses) - 1)]
        self.calls += 1
        if outcome == "TRUNCATED":
            if raise_on_truncation:
                raise OutputTruncatedError(partial_text="", max_tokens=max_tokens)
            return ""
        return outcome

    async def generate(self, system, user, max_tokens=1024, raise_on_truncation=False, temperature=None):
        return await self.extract(system, user, max_tokens, raise_on_truncation, temperature)

    def count_tokens(self, text: str) -> int:
        return len(text) // 4  # estimation grossière, suffisante pour ces tests


def _pipeline(llm) -> ScoringPipeline:
    return ScoringPipeline(llm=llm, rag_engine=None)


def test_step1_extract_retente_a_budget_elargi_si_tronque():
    ok_json = '{"key_points": [], "besoins": [{"texte": "Migration Odoo", "source_section": "3.1"}]}'
    llm = FakeLLM(["TRUNCATED", ok_json])
    pipeline = _pipeline(llm)

    elements, extra = asyncio.run(pipeline._step1_extract("texte de l'AO"))

    assert llm.calls == 2  # 1er essai tronqué, retry réussi
    assert llm.max_tokens_seen[1] > llm.max_tokens_seen[0]  # budget élargi au retry
    assert len(extra["besoins"]) == 1
    assert extra["besoins"][0].texte == "Migration Odoo"


def test_step1_extract_vide_honnetement_si_toujours_tronque():
    llm = FakeLLM(["TRUNCATED", "TRUNCATED"])
    pipeline = _pipeline(llm)

    elements, extra = asyncio.run(pipeline._step1_extract("texte de l'AO"))

    assert llm.calls == 2
    assert elements == []
    assert extra["besoins"] == []  # honnête : vide, pas de contenu inventé


def test_frame_grille_degeneree_retombe_sur_grille_standard(monkeypatch):
    # Critères extraits (liste non vide) mais tous à 0 point — cas réel rencontré sur
    # un AO qui décrit ses critères en prose sans grille pondérée explicite.
    monkeypatch.setattr(ScoringPipeline, "_load_standard_grid", staticmethod(lambda doc_type="regie_it": _FAKE_STANDARD_GRID))
    degenerate = (
        '{"market_identity": {}, "calendar": [], "evaluation_modalities": {},'
        ' "criteria": [{"id": "1", "label": "Expérience", "max_points": 0, "category": "Technique"},'
        ' {"id": "2", "label": "Méthodologie", "max_points": 0, "category": "Technique"}]}'
    )
    llm = FakeLLM([degenerate])
    pipeline = _pipeline(llm)

    _, _, _, criteria = asyncio.run(pipeline._step1b_extract_frame("texte de l'AO"))

    assert criteria == _FAKE_STANDARD_GRID  # grille standard, pas la dégénérée
    assert all(c.is_inferred for c in criteria)  # jamais présentée comme vérité de l'AO


def test_frame_grille_verbatim_avec_points_reels_est_conservee():
    real = (
        '{"market_identity": {}, "calendar": [], "evaluation_modalities": {},'
        ' "criteria": [{"id": "1", "label": "Prix", "max_points": 40, "category": "Financier"},'
        ' {"id": "2", "label": "Technique", "max_points": 60, "category": "Technique"}]}'
    )
    llm = FakeLLM([real])
    pipeline = _pipeline(llm)

    _, _, _, criteria = asyncio.run(pipeline._step1b_extract_frame("texte de l'AO"))

    assert sum(c.max_points for c in criteria) == 100
    labels = {c.label for c in criteria}
    assert labels == {"Prix", "Technique"}
