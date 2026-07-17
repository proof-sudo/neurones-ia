from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, Boolean, DateTime, JSON, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from db.database import Base


class GEDEntryModel(Base):
    __tablename__ = "ged_entries"

    doc_id: Mapped[str] = mapped_column(String, primary_key=True)
    file_path: Mapped[str] = mapped_column(String, unique=True, index=True)
    hash_sha256: Mapped[str] = mapped_column(String(64))
    doc_type: Mapped[str] = mapped_column(String(50))
    last_indexed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    vector_ids: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ClientModel(Base):
    __tablename__ = "clients"

    client_id: Mapped[str] = mapped_column(String, primary_key=True)
    odoo_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    solvency_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ContractModel(Base):
    __tablename__ = "contracts"

    contract_id: Mapped[str] = mapped_column(String, primary_key=True)
    odoo_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    client_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String(500))
    value: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="XOF")
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InvoiceModel(Base):
    __tablename__ = "invoices"

    invoice_id: Mapped[str] = mapped_column(String, primary_key=True)
    odoo_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    client_id: Mapped[str] = mapped_column(String, index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="XOF")
    due_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    invoice_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invoice_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    amount_residual: Mapped[float] = mapped_column(Float, default=0.0)  # montant restant à payer
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProjectModel(Base):
    __tablename__ = "projects"

    project_id: Mapped[str] = mapped_column(String, primary_key=True)
    odoo_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    client_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    technologies: Mapped[list] = mapped_column(JSON, default=list)
    engineers: Mapped[list] = mapped_column(JSON, default=list)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SaleOrderModel(Base):
    __tablename__ = "sale_orders"

    order_id: Mapped[str] = mapped_column(String, primary_key=True)
    odoo_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    client_id: Mapped[str] = mapped_column(String, index=True)
    client_name: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)   # ex: FP/2026/12977
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="XOF")
    date_order: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    state: Mapped[str] = mapped_column(String(50), default="sale")  # draft/sale/done/cancel
    salesperson_name: Mapped[str] = mapped_column(String(255), default="")
    dossier_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_lines: Mapped[list] = mapped_column(JSON, default=list)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PurchaseOrderModel(Base):
    __tablename__ = "purchase_orders"

    order_id: Mapped[str] = mapped_column(String, primary_key=True)
    odoo_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    client_id: Mapped[str] = mapped_column(String, index=True)   # vendor partner_id
    client_name: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)   # ex: PO/2026/00123
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="XOF")
    date_order: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    state: Mapped[str] = mapped_column(String(50), default="purchase")
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="user")   # "admin" | "user" | "viewer"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ModulePermissionModel(Base):
    """Surcharge d'une cellule de la matrice module × rôle (écran Administration).

    Table vide = matrice par défaut de config/permissions.py. Chaque ligne
    remplace UNE cellule (view, role) — les défauts restent la référence pour
    toutes les cellules non surchargées.
    """
    __tablename__ = "module_permissions"
    __table_args__ = (Index("ix_module_perm_view_role", "view", "role", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    view: Mapped[str] = mapped_column(String(50))
    role: Mapped[str] = mapped_column(String(50))
    allowed: Mapped[bool] = mapped_column(Boolean)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConversationModel(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index("ix_conv_session_user_time", "session_id", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    role: Mapped[str] = mapped_column(String(20))        # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TokenUsageModel(Base):
    __tablename__ = "token_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    use_case: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(100))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cached_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_fcfa: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VeilleSourceModel(Base):
    __tablename__ = "veille_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(500))
    feed_type: Mapped[str] = mapped_column(String(50), default="rss")  # "rss" | "html"
    keywords: Mapped[str] = mapped_column(String(1000), default="")   # mots-clés séparés par virgules
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_scan: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class VeilleEntryModel(Base):
    __tablename__ = "veille_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("veille_sources.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(String(2000), default="")
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(50), default="new")   # "new" | "read" | "archived" | "in_presales"
    estimated_budget: Mapped[str] = mapped_column(String(200), default="")
    deadline: Mapped[str] = mapped_column(String(100), default="")
    country: Mapped[str] = mapped_column(String(100), default="CI")
    relevance_score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100

    # ── Analyse IA S2I (agent Watch-Tracker) : signal → risque → offre ──────────
    # Rempli par modules/uc_veille/classifier.py au moment du scan. ai_analyzed
    # distingue une entrée traitée par Claude d'une entrée brute (repli front).
    ai_analyzed: Mapped[bool] = mapped_column(Boolean, default=False)
    signal_label: Mapped[str] = mapped_column(String(255), default="")
    risque: Mapped[str] = mapped_column(String(500), default="")
    offre: Mapped[str] = mapped_column(String(500), default="")
    offre_short: Mapped[str] = mapped_column(String(100), default="")
    priority: Mapped[str] = mapped_column(String(20), default="")   # CRITIQUE | ELEVEE | MOYENNE | ""
    criticite: Mapped[int] = mapped_column(Integer, default=0)      # 0-100 (score IA argumenté)
    organisation: Mapped[str] = mapped_column(String(255), default="")
    justification: Mapped[str] = mapped_column(String(1000), default="")
    origin: Mapped[str] = mapped_column(String(20), default="source")  # "source" | "web"
    # Débriefing pré-généré au scan (Claude lit la page réelle) : affiché tel quel
    # au clic, sans nouvelle génération ni lecture web. Vide = pas encore généré.
    debrief: Mapped[str] = mapped_column(Text, default="")


class VeilleConfigModel(Base):
    """Configuration globale de l'agent Watch-Tracker (ligne unique, id=1).

    Pilote « ce sur quoi l'agent se base » : thèmes prioritaires injectés dans le
    prompt Claude, et bascule d'exploration web.
    """
    __tablename__ = "veille_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # singleton : toujours 1
    themes: Mapped[str] = mapped_column(String(2000), default="")
    web_search_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OpportunityModel(Base):
    __tablename__ = "opportunities"

    opp_id: Mapped[str] = mapped_column(String, primary_key=True)   # "opp_{odoo_id}"
    odoo_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    client_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    client_name: Mapped[str] = mapped_column(String(255), default="")
    name: Mapped[str] = mapped_column(String(500))
    stage: Mapped[str] = mapped_column(String(100), default="")
    expected_revenue: Mapped[float] = mapped_column(Float, default=0.0)
    probability: Mapped[float] = mapped_column(Float, default=0.0)   # 0–100
    salesperson_name: Mapped[str] = mapped_column(String(255), default="")
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class QuarantineModel(Base):
    """Fichiers rejetés par le QualityValidator — en attente de correction manuelle."""
    __tablename__ = "quarantine"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_path: Mapped[str] = mapped_column(String, unique=True, index=True)
    doc_type: Mapped[str] = mapped_column(String(50))
    reason: Mapped[str] = mapped_column(String(1000))
    quarantined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    text_length: Mapped[int] = mapped_column(Integer, default=0)


class DossierModel(Base):
    """Miroir de neurones.dossier.manager — dossiers commerciaux avec marges."""
    __tablename__ = "dossiers"

    dossier_ref: Mapped[str] = mapped_column(String(50), primary_key=True)   # ex: DC/2026/0154
    odoo_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    client_name: Mapped[str] = mapped_column(String(255), index=True, default="")
    project_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    salesperson: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str] = mapped_column(String(20), default="draft")   # draft/confirmed/done/cancel
    date_creation: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    date_end_project: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Chiffre d'affaires
    ca_provisoire: Mapped[float] = mapped_column(Float, default=0.0)
    ca_definitif: Mapped[float] = mapped_column(Float, default=0.0)
    # Dépenses
    depense_provisoire: Mapped[float] = mapped_column(Float, default=0.0)
    depense_definitive: Mapped[float] = mapped_column(Float, default=0.0)
    # Marges (valeur)
    marge_previsionnelle: Mapped[float] = mapped_column(Float, default=0.0)
    marge_provisoire: Mapped[float] = mapped_column(Float, default=0.0)
    marge_definitive: Mapped[float] = mapped_column(Float, default=0.0)
    # Marges (%)
    perc_marge_previsionnelle: Mapped[float] = mapped_column(Float, default=0.0)
    perc_marge_provisoire: Mapped[float] = mapped_column(Float, default=0.0)
    perc_marge_definitive: Mapped[float] = mapped_column(Float, default=0.0)
    # Encaissements / fournisseurs
    montant_recu: Mapped[float] = mapped_column(Float, default=0.0)
    reste_a_encaisser: Mapped[float] = mapped_column(Float, default=0.0)
    backlog: Mapped[float] = mapped_column(Float, default=0.0)
    fournisseurs_payes: Mapped[float] = mapped_column(Float, default=0.0)
    fournisseurs_restant: Mapped[float] = mapped_column(Float, default=0.0)
    # Compteurs
    nb_bdc: Mapped[int] = mapped_column(Integer, default=0)
    nb_factures_client: Mapped[int] = mapped_column(Integer, default=0)
    nb_factures_fournisseur: Mapped[int] = mapped_column(Integer, default=0)
    nb_achats: Mapped[int] = mapped_column(Integer, default=0)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ════════════════════════════════════════════════════════════════════════════
# COUCHE STRUCTURÉE (kb_*) — faits typés extraits des documents GED (Phase 1).
# Préfixe `kb_` pour ne PAS entrer en collision avec les tables miroir Odoo
# `clients` / `projects`. Alimentées par le StructuredExtractor + SQLiteKBAdapter.
# ════════════════════════════════════════════════════════════════════════════


class _KBFactCommon:
    """Colonnes techniques communes à toute table de faits (traçabilité + audit).

    `doc_id` n'est PAS ici : les tables de tête l'utilisent en clé primaire,
    les tables enfants en colonne indexée + FK logique.
    """
    doc_type: Mapped[str] = mapped_column(String(50), default="")
    fichier_source: Mapped[str] = mapped_column(String, default="")
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hash_sha256: Mapped[str] = mapped_column(String(64), default="")
    date_ingestion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    score_confiance: Mapped[float] = mapped_column(Float, default=0.0)
    revue_humaine: Mapped[bool] = mapped_column(Boolean, default=False)


# ── Entités canoniques (pivots) — créées en P1, peuplées en P2 ───────────────

class KBClientModel(Base):
    __tablename__ = "kb_clients"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    raison_sociale: Mapped[str] = mapped_column(String(255), index=True)
    secteur: Mapped[str | None] = mapped_column(String(150), nullable=True)
    pays: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class KBPersonneModel(Base):
    __tablename__ = "kb_personnes"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    nom_complet: Mapped[str] = mapped_column(String(255), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class KBProjetModel(Base):
    __tablename__ = "kb_projets"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    intitule: Mapped[str] = mapped_column(String(500), index=True)
    client_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_clients.id"), nullable=True)
    secteur: Mapped[str | None] = mapped_column(String(150), nullable=True)
    montant_valeur: Mapped[float | None] = mapped_column(Float, nullable=True)
    montant_devise: Mapped[str | None] = mapped_column(String(10), nullable=True)
    date_debut: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_fin: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ── CV ───────────────────────────────────────────────────────────────────────

class KBCvModel(Base, _KBFactCommon):
    __tablename__ = "kb_cv"
    doc_id: Mapped[str] = mapped_column(String, primary_key=True)
    nom_complet: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    titre_poste: Mapped[str | None] = mapped_column(String(255), nullable=True)
    annees_experience: Mapped[float | None] = mapped_column(Float, nullable=True)
    localisation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    personne_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_personnes.id"), nullable=True)
    langues: Mapped[list] = mapped_column(JSON, default=list)
    competences: Mapped[list] = mapped_column(JSON, default=list)
    formations: Mapped[list] = mapped_column(JSON, default=list)
    secteurs_expertise: Mapped[list] = mapped_column(JSON, default=list)


class KBCvExperienceModel(Base):
    __tablename__ = "kb_cv_experiences"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("kb_cv.doc_id"), index=True)
    intitule_projet: Mapped[str | None] = mapped_column(String(500), nullable=True)
    client: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    secteur: Mapped[str | None] = mapped_column(String(150), index=True, nullable=True)
    date_debut: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_fin: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    en_cours: Mapped[bool] = mapped_column(Boolean, default=False)
    description_courte: Mapped[str | None] = mapped_column(Text, nullable=True)
    projet_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_projets.id"), nullable=True)


class KBCvCertificationModel(Base):
    __tablename__ = "kb_cv_certifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("kb_cv.doc_id"), index=True)
    intitule: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    organisme: Mapped[str | None] = mapped_column(String(255), nullable=True)
    annee: Mapped[int | None] = mapped_column(Integer, nullable=True)


# ── Appel d'offres ───────────────────────────────────────────────────────────

class KBAoModel(Base, _KBFactCommon):
    __tablename__ = "kb_ao"
    doc_id: Mapped[str] = mapped_column(String, primary_key=True)
    reference: Mapped[str | None] = mapped_column(String(150), index=True, nullable=True)
    intitule: Mapped[str | None] = mapped_column(String(500), nullable=True)
    maitre_ouvrage: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date_publication: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_limite_remise: Mapped[datetime | None] = mapped_column(DateTime, index=True, nullable=True)
    budget_valeur: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_devise: Mapped[str | None] = mapped_column(String(10), nullable=True)
    type_marche: Mapped[str | None] = mapped_column(String(150), nullable=True)
    duree_execution: Mapped[str | None] = mapped_column(String(150), nullable=True)
    client_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_clients.id"), nullable=True)
    projet_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_projets.id"), nullable=True)
    lots: Mapped[list] = mapped_column(JSON, default=list)
    certifications_exigees: Mapped[list] = mapped_column(JSON, default=list)
    criteres_evaluation: Mapped[list] = mapped_column(JSON, default=list)


class KBAoExigenceModel(Base):
    __tablename__ = "kb_ao_exigences"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("kb_ao.doc_id"), index=True)
    categorie: Mapped[str | None] = mapped_column(String(50), nullable=True)
    libelle: Mapped[str | None] = mapped_column(Text, nullable=True)
    obligatoire: Mapped[bool] = mapped_column(Boolean, default=True)


class KBAoReferenceDemandeeModel(Base):
    __tablename__ = "kb_ao_references_demandees"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("kb_ao.doc_id"), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    nombre_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    montant_min_valeur: Mapped[float | None] = mapped_column(Float, nullable=True)
    montant_min_devise: Mapped[str | None] = mapped_column(String(10), nullable=True)
    periode: Mapped[str | None] = mapped_column(String(150), nullable=True)


# ── Compte rendu ─────────────────────────────────────────────────────────────

class KBCompteRenduModel(Base, _KBFactCommon):
    __tablename__ = "kb_compte_rendu"
    doc_id: Mapped[str] = mapped_column(String, primary_key=True)
    date_reunion: Mapped[datetime | None] = mapped_column(DateTime, index=True, nullable=True)
    objet: Mapped[str | None] = mapped_column(String(500), nullable=True)
    projet_associe: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lieu: Mapped[str | None] = mapped_column(String(255), nullable=True)
    projet_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_projets.id"), nullable=True)
    participants: Mapped[list] = mapped_column(JSON, default=list)
    decisions: Mapped[list] = mapped_column(JSON, default=list)
    points_abordes: Mapped[list] = mapped_column(JSON, default=list)


class KBCrActionModel(Base):
    __tablename__ = "kb_cr_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("kb_compte_rendu.doc_id"), index=True)
    libelle: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsable: Mapped[str | None] = mapped_column(String(255), nullable=True)
    echeance: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    statut: Mapped[str | None] = mapped_column(String(100), nullable=True)


# ── Certification ────────────────────────────────────────────────────────────

class KBCertificationModel(Base, _KBFactCommon):
    __tablename__ = "kb_certification"
    doc_id: Mapped[str] = mapped_column(String, primary_key=True)
    titulaire: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    intitule: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    organisme_emetteur: Mapped[str | None] = mapped_column(String(255), nullable=True)
    numero_identifiant: Mapped[str | None] = mapped_column(String(150), nullable=True)
    date_emission: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_expiration: Mapped[datetime | None] = mapped_column(DateTime, index=True, nullable=True)
    statut: Mapped[str | None] = mapped_column(String(50), nullable=True)
    domaine: Mapped[str | None] = mapped_column(String(150), nullable=True)
    personne_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_personnes.id"), nullable=True)


# ── PV de recette ────────────────────────────────────────────────────────────

class KBPvRecetteModel(Base, _KBFactCommon):
    __tablename__ = "kb_pv_recette"
    doc_id: Mapped[str] = mapped_column(String, primary_key=True)
    reference: Mapped[str | None] = mapped_column(String(150), index=True, nullable=True)
    projet_associe: Mapped[str | None] = mapped_column(String(500), index=True, nullable=True)
    client: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date: Mapped[datetime | None] = mapped_column(DateTime, index=True, nullable=True)
    type_recette: Mapped[str | None] = mapped_column(String(50), nullable=True)
    statut_global: Mapped[str | None] = mapped_column(String(50), nullable=True)
    projet_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_projets.id"), nullable=True)
    client_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_clients.id"), nullable=True)
    livrables: Mapped[list] = mapped_column(JSON, default=list)
    signataires: Mapped[list] = mapped_column(JSON, default=list)


class KBPvReserveModel(Base):
    __tablename__ = "kb_pv_reserves"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("kb_pv_recette.doc_id"), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    criticite: Mapped[str | None] = mapped_column(String(50), nullable=True)
    statut: Mapped[str | None] = mapped_column(String(50), index=True, nullable=True)
    date_levee: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ── Attestation de bonne exécution ───────────────────────────────────────────

class KBAttestationModel(Base, _KBFactCommon):
    __tablename__ = "kb_attestation"
    doc_id: Mapped[str] = mapped_column(String, primary_key=True)
    reference: Mapped[str | None] = mapped_column(String(150), nullable=True)
    emetteur_client: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    projet_marche: Mapped[str | None] = mapped_column(String(500), index=True, nullable=True)
    montant_valeur: Mapped[float | None] = mapped_column(Float, index=True, nullable=True)
    montant_devise: Mapped[str | None] = mapped_column(String(10), nullable=True)
    date_debut: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_fin: Mapped[datetime | None] = mapped_column(DateTime, index=True, nullable=True)
    duree_mois: Mapped[int | None] = mapped_column(Integer, nullable=True)
    niveau_appreciation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    secteur: Mapped[str | None] = mapped_column(String(150), index=True, nullable=True)
    client_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_clients.id"), nullable=True)
    projet_ref_id: Mapped[str | None] = mapped_column(String, ForeignKey("kb_projets.id"), nullable=True)
    perimetre_prestations: Mapped[list] = mapped_column(JSON, default=list)
    signataire: Mapped[dict] = mapped_column(JSON, default=dict)


class KBAliasModel(Base):
    """Journal des libellés observés → entité canonique (Phase 2).

    Sert d'index de recherche normalisé ET de file de revue humaine :
    - status `confirmed` : alias canonique (ou validé par un humain) ;
    - status `auto`      : rapproché automatiquement (score ≥ seuil auto) ;
    - status `pending`   : rapprochement incertain → revue humaine requise
      (`entity_id` = suggestion ; le fait n'est PAS lié tant que non confirmé).
    """
    __tablename__ = "kb_aliases"
    __table_args__ = (Index("ix_kb_alias_type_norm", "entity_type", "alias_norm"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(20), index=True)   # client | personne | projet
    alias_norm: Mapped[str] = mapped_column(String(500), index=True)
    alias_raw: Mapped[str] = mapped_column(String(500), default="")
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="auto")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    source_doc_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
