from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class BidRecommendation(str, Enum):
    GO = "GO"
    NO_BID = "NO_BID"
    CONDITIONAL = "CONDITIONAL"


@dataclass
class KeyElement:
    category: str
    value: str
    confidence: float = 1.0


@dataclass
class MatchedDocument:
    doc_id: str
    filename: str
    doc_type: str
    relevance_score: float
    excerpt: str


@dataclass
class ScoringResult:
    """Résultat complet du pipeline de scoring AO en 5 étapes."""
    ao_filename: str
    summary: str
    key_elements: list[KeyElement]
    matched_documents: list[MatchedDocument]
    gaps_analysis: str
    strengths: list[str]
    risks: list[str]
    score: int
    recommendation: BidRecommendation
    justification: str
    # Champs d'analyse détaillée (Phase 1 Bid Management)
    criteres_selection: list[str] = field(default_factory=list)
    besoins: list[str] = field(default_factory=list)
    prerequis: list[str] = field(default_factory=list)
    ressources_demandees: list[str] = field(default_factory=list)
    points_vigilance: list[str] = field(default_factory=list)
    date_remise: str = ""
    # Matching GED automatique (Step 3 pipeline)
    team_matches: list[MatchedDocument] = field(default_factory=list)
    similar_projects: list[MatchedDocument] = field(default_factory=list)


@dataclass
class RFP:
    """Appel d'Offres uploadé par l'utilisateur."""
    filename: str
    content: str
    file_type: str


@dataclass
class OfferDraft:
    """Offre technique générée."""
    filename: str
    content_docx: bytes
    ao_filename: str
    sections: list[str] = field(default_factory=list)
