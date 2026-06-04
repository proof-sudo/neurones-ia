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


class MarketIdentitySchema(BaseModel):
    type_marche: str = ""
    reference: str = ""
    autorite_contractante: str = ""
    duree_contrat: str = ""
    date_demarrage: str = ""
    deadline_soumission: str = ""
    validite_offre: str = ""
    perimetre_geographique: str = ""
    eligibilite_candidat: str = ""
    confidence: float = 0.0


class CalendarEventSchema(BaseModel):
    label: str
    date: str
    criticite: str = "INFO"
    source_section: str = ""


class EvaluationModalitiesSchema(BaseModel):
    ponderation_technique: int = 0
    ponderation_financiere: int = 0
    seuil_minimum_technique: int = 0
    formule_notation_financiere: str = ""
    modalites: list[str] = []
    confidence: float = 0.0


class ScoringCriterionSchema(BaseModel):
    id: str
    label: str
    max_points: int
    category: str = ""
    is_inferred: bool = False
    estimated_score: int = 0
    risk_level: str = "MODÉRÉ"
    rationale: str = ""
    sources_ged: list[str] = []


class RiskSchema(BaseModel):
    label: str
    criticite: str = "MODÉRÉ"
    pourquoi: str = ""
    mitigation: str = ""
    items_affected: list[str] = []


class PreconditionSchema(BaseModel):
    label: str
    type: str = "ADMIN"
    deadline: str = ""
    responsable: str = ""
    status: str = "PENDING"
    blocking: bool = False
    pieces_requises: list[str] = []


class AppendixSchema(BaseModel):
    code: str
    label: str
    type: str = "ADMIN"
    obligatoire: bool = True
    langue: str = ""
    responsable: str = ""
    deadline_interne: str = ""
    statut: str = "PENDING"
    source_section: str = ""
    note: str = ""


class RequiredProfileSchema(BaseModel):
    profil: str
    domaine: str = ""
    quantite: int = 0
    niveau: str = ""
    experience_min: str = ""
    competences: list[str] = []
    certifications: list[str] = []
    missions: list[str] = []
    rattachement: str = ""
    source_section: str = ""


class EligibilityThresholdSchema(BaseModel):
    libelle: str
    valeur: str = ""
    unite: str = ""
    type: str = "AUTRE"
    blocking: bool = True
    source_section: str = ""


class FinancialDataSchema(BaseModel):
    budget_estime: str = ""
    modalites_paiement: str = ""
    garantie_soumission: str = ""
    penalites: str = ""
    source_section: str = ""


class ScoringResultSchema(BaseModel):
    ao_filename: str
    summary: str
    key_elements: list[KeyElementSchema]
    matched_documents: list[MatchedDocumentSchema]
    gaps_analysis: str
    strengths: list[str]
    risks: list[RiskSchema]
    score: int = Field(ge=0, le=100)
    score_basis: str = "GRILLE"  # GRILLE | ESTIME | INDISPONIBLE
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
    market_identity: MarketIdentitySchema = Field(default_factory=MarketIdentitySchema)
    calendar: list[CalendarEventSchema] = []
    evaluation_modalities: EvaluationModalitiesSchema = Field(default_factory=EvaluationModalitiesSchema)
    criteria_breakdown: list[ScoringCriterionSchema] = []
    preconditions: list[PreconditionSchema] = []
    preconditions_incomplete: bool = False
    appendices: list[AppendixSchema] = []
    appendices_incomplete: bool = False
    profils_demandes: list[RequiredProfileSchema] = []
    seuils_eligibilite: list[EligibilityThresholdSchema] = []
    donnees_financieres: FinancialDataSchema = Field(default_factory=FinancialDataSchema)


class PartnerSchema(BaseModel):
    name: str
    role: str = "membre_groupement"
    type: str = "entreprise"


class PhaseActionSchema(BaseModel):
    day_label: str
    action: str
    responsable: str = ""
    duree_estimee: str = ""
    deliverable: str = ""
    statut: str = "PENDING"


class StrategyPhaseSchema(BaseModel):
    id: str
    name: str
    description: str = ""
    start_day: str = ""
    end_day: str = ""
    actions: list[PhaseActionSchema] = []
    prerequisites: list[str] = []
    is_blocking_next: bool = False


class BidStrategyRequest(BaseModel):
    scoring_result: ScoringResultSchema
    client_name: Optional[str] = None
    decision: str = "GO"
    decision_reason: Optional[str] = None
    partner: Optional[PartnerSchema] = None


class BidStrategySchema(BaseModel):
    phases: list[StrategyPhaseSchema] = []
    strategy_text: str = ""
    response_plan: str = ""
    appendices: list[AppendixSchema] = []
    partner: Optional[PartnerSchema] = None
    partner_validation: list[PreconditionSchema] = []
    version: int = 1
    parent_version: Optional[int] = None
    generated_at: str = ""


class AnalysisExportRequest(BaseModel):
    scoring_result: ScoringResultSchema
    client_name: Optional[str] = None


class StrategyExportRequest(BaseModel):
    scoring_result: ScoringResultSchema
    bid_strategy: BidStrategySchema
    client_name: Optional[str] = None
    decision: str = "GO"


class ChecklistExportRequest(BaseModel):
    ao_filename: str
    client_name: Optional[str] = None
    submission_date: str = ""
    # Pièces réelles extraites de l'AO (avec statut édité côté frontend).
    # Si vide → l'export retombe sur une checklist générique inférée.
    appendices: list[AppendixSchema] = []


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
