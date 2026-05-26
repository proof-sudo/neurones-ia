from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


class BidRecommendationSchema(str, Enum):
    GO = "GO"
    NO_BID = "NO_BID"
    CONDITIONAL = "CONDITIONAL"


class KeyElementSchema(BaseModel):
    category: str
    value: str
    confidence: float = 1.0


class MatchedDocumentSchema(BaseModel):
    doc_id: str
    filename: str
    doc_type: str
    relevance_score: float
    excerpt: str


class ScoringResultSchema(BaseModel):
    ao_filename: str
    summary: str
    key_elements: list[KeyElementSchema]
    matched_documents: list[MatchedDocumentSchema]
    gaps_analysis: str
    strengths: list[str]
    risks: list[str]
    score: int = Field(ge=0, le=100)
    recommendation: BidRecommendationSchema
    justification: str
    criteres_selection: list[str] = []
    besoins: list[str] = []
    prerequis: list[str] = []
    ressources_demandees: list[str] = []
    points_vigilance: list[str] = []
    date_remise: str = ""
    team_matches: list[MatchedDocumentSchema] = []
    similar_projects: list[MatchedDocumentSchema] = []


class BidStrategyRequest(BaseModel):
    scoring_result: ScoringResultSchema
    client_name: Optional[str] = None
    decision: str = "GO"
    decision_reason: Optional[str] = None


class BidStrategyResponse(BaseModel):
    strategy: str
    chronogram: list[dict]
    response_plan: str = ""


class AnalysisExportRequest(BaseModel):
    scoring_result: ScoringResultSchema
    client_name: Optional[str] = None


class StrategyExportRequest(BaseModel):
    scoring_result: ScoringResultSchema
    strategy: str
    chronogram: list[dict]
    response_plan: str = ""
    client_name: Optional[str] = None
    decision: str = "GO"


class ChecklistItemSchema(BaseModel):
    category: str
    label: str
    required: bool
    checked: bool
    note: str = ""


class ChecklistExportRequest(BaseModel):
    ao_filename: str
    client_name: Optional[str] = None
    submission_date: str = ""
    items: list[ChecklistItemSchema]


class OfferGenerationRequest(BaseModel):
    ao_filename: str
    scoring_result: ScoringResultSchema
    client_name: Optional[str] = None
    additional_context: Optional[str] = None


class OfferGenerationResponse(BaseModel):
    filename: str
    message: str


class TeamMatchRequest(BaseModel):
    requirements: list[str]
    ao_context: str = ""
    top_k: int = 6

class TeamMatchProfile(BaseModel):
    filename: str
    name: str
    excerpt: str
    relevance_score: float
    match_reasons: list[str] = []

class TeamMatchResponse(BaseModel):
    profiles: list[TeamMatchProfile]
    query_used: str
