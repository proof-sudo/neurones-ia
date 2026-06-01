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
