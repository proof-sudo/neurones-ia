"use client";
/* eslint-disable react/no-unescaped-entities -- port verbatim du module presales (apostrophes françaises dans le JSX) */
import { useState, useRef, useEffect } from "react";
import React from "react";
import {
  Upload, FileText, CheckCircle, XCircle, AlertCircle, AlertTriangle,
  Download, Loader2, Trash2, Sparkles, ArrowRight, ArrowLeft, Shield, Target,
  Users, Eye, ClipboardList, BarChart2, Layers, Lock, Plus, Send,
  CalendarDays, Trophy, ThumbsDown, Clock, List,
  Briefcase, Scale, Coins, X, Search, ChevronDown, FileCheck, Play, Pencil, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import {
  generateBidStrategy, exportAnalysis, exportScoring, exportStrategy,
  exportMatrix, exportChecklist, buildOfferSections, renderOffer,
  fetchGEDFiles, uploadGEDFile, itemText, assessMatrix, confirmMatrix,
  createDossier, listDossiers, patchDossier, deleteDossier, analyzeDossier, downloadDossierFile,
  type GEDFile, type ExtractedItem, type ConformityExigence,
  type ScoringResult, type BidStrategy, type OfferSections,
  type MarketIdentity, type CalendarEvent, type EvaluationModalities,
  type ScoringCriterion, type Risk, type Precondition,
  type StrategyPhase, type Appendix,
  type RequiredProfile, type EligibilityThreshold, type FinancialData,
} from "@/lib/presales-api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  category: "Technique" | "Administratif" | "Commercial";
  label: string;
  required: boolean;
  checked: boolean;
  note: string;
}

interface AOEntry {
  id: string;
  filename: string;
  addedAt: string;
  clientName: string;
  owner: string;      // nom de la personne qui saisit / pilote l'offre
  deadline: string;   // date d'échéance saisie manuellement à l'ajout
  status: "pending_analysis" | "scoring" | "scored" | "error";
  errorMessage?: string;
  scoringResult?: ScoringResult;
  decision: "go" | "no_bid" | "conditional" | null;
  decisionReason: string;
  decisionValidated: boolean;
  bidStrategy?: BidStrategy;
  strategyText: string;
  strategyValidated: boolean;
  responsePlan: string;
  responsePlanValidated: boolean;
  // Phase 2
  offerGenerating: boolean;
  offerGenerated: boolean;
  offerFilename: string;
  offerValidated: boolean;
  checklist: ChecklistItem[];
  checklistValidated: boolean;
  submissionDate: string;
  submissionChannel: string;
  submissionNote: string;
  submissionValidated: boolean;
  // Résultat
  result: "won" | "lost" | "pending" | null;
  competitor: string;
  resultNote: string;
  resultDate: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function NumberedAnalysis({ text }: { text: string }) {
  if (!text) return null;
  // Si pas de pattern "(N)" → rendu markdown classique
  if (!/\(\d+\)/.test(text)) {
    return (
      <div className="prose prose-sm max-w-none text-text">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }
  // Découpe sur les marqueurs "(1)", "(2)"… en conservant l'intro éventuelle
  const parts = text.split(/\s*\((\d+)\)\s*/);
  const intro = parts[0]?.trim();
  const items: { num: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    items.push({ num: parts[i], body: (parts[i + 1] ?? "").trim() });
  }
  return (
    <div className="text-sm text-text leading-relaxed">
      {intro && <p className="mb-3">{intro}</p>}
      <ol className="space-y-2">
        {items.map((it) => (
          <li key={it.num} className="flex gap-2.5">
            <span className="font-semibold text-text shrink-0 min-w-[1.5rem]">{it.num}.</span>
            <span className="flex-1">{it.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function newEntry(id: string, filename: string): AOEntry {
  return {
    id, filename,
    addedAt: new Date().toISOString(),
    clientName: "",
    owner: "",
    deadline: "",
    status: "pending_analysis",
    decision: null,
    decisionReason: "",
    decisionValidated: false,
    strategyText: "",
    strategyValidated: false,
    responsePlan: "",
    responsePlanValidated: false,
    offerGenerating: false,
    offerGenerated: false,
    offerFilename: "",
    offerValidated: false,
    checklist: [],
    checklistValidated: false,
    submissionDate: "",
    submissionChannel: "",
    submissionNote: "",
    submissionValidated: false,
    result: null,
    competitor: "",
    resultNote: "",
    resultDate: "",
  };
}

function getActiveStep(ao: AOEntry): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (!ao.scoringResult) return 1;
  if (!ao.decisionValidated) return 2;
  if (ao.decision === "no_bid") return 2;
  if (!ao.strategyValidated) return 3;
  if (!ao.offerValidated) return 5;
  if (!ao.checklistValidated) return 6;
  return 7;
}

function canViewStep(ao: AOEntry, step: number): boolean {
  if (!ao.scoringResult) return false;
  if (step === 1 || step === 2) return true;
  if (step === 3) return ao.decisionValidated && ao.decision !== "no_bid";
  const phase1Done = ao.strategyValidated && ao.decision !== "no_bid";
  if (step === 5) return phase1Done;
  if (step === 6) return phase1Done && ao.offerValidated;
  if (step === 7) return phase1Done && ao.checklistValidated;
  return false;
}

function isStepDone(ao: AOEntry, step: number): boolean {
  if (step === 1) return !!ao.scoringResult;
  if (step === 2) return ao.decisionValidated;
  if (step === 3) return ao.strategyValidated;
  if (step === 5) return ao.offerValidated;
  if (step === 6) return ao.checklistValidated;
  if (step === 7) return ao.submissionValidated;
  return false;
}

function generateChecklist(r: ScoringResult): ChecklistItem[] {
  const uid = () => genId();
  const items: ChecklistItem[] = [];

  // ── Technique ──────────────────────────────────────────────────────────────
  items.push({ id: uid(), category: "Technique", label: "Offre technique rédigée et validée en interne", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Technique", label: "CV des intervenants clés joints au dossier", required: true, checked: false, note: "" });
  (r.ressources_demandees ?? []).slice(0, 6).forEach(res => {
    items.push({ id: uid(), category: "Technique", label: `CV — ${itemText(res)}`, required: true, checked: false, note: "" });
  });
  items.push({ id: uid(), category: "Technique", label: "Références de projets similaires (fiches projet ou PV de recette)", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Technique", label: "Planning de réalisation détaillé", required: false, checked: false, note: "" });

  // ── Administratif ──────────────────────────────────────────────────────────
  items.push({ id: uid(), category: "Administratif", label: "Registre du Commerce et du Crédit Mobilier (RCCM)", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Administratif", label: "Attestation de régularité fiscale (DGI)", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Administratif", label: "Attestation de régularité CNPS", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Administratif", label: "Statuts de la société et pouvoirs du signataire", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Administratif", label: "Bilans financiers des 3 derniers exercices", required: false, checked: false, note: "" });
  const docKeywords = ["certif", "assur", "agré", "habilit", "attestation", "autorisation", "label", "norme", "iso", "bilan", "capacité financ"];
  (r.prerequis ?? []).forEach(p => {
    const txt = itemText(p);
    const lp = txt.toLowerCase();
    if (docKeywords.some(k => lp.includes(k))) {
      items.push({ id: uid(), category: "Administratif", label: txt, required: true, checked: false, note: "" });
    }
  });

  // ── Commercial ─────────────────────────────────────────────────────────────
  items.push({ id: uid(), category: "Commercial", label: "Offre financière / BPU complétée et signée", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Commercial", label: "Lettre de soumission signée et cachetée", required: true, checked: false, note: "" });
  items.push({ id: uid(), category: "Commercial", label: "Cautionnement de soumission (le cas échéant)", required: false, checked: false, note: "" });
  items.push({ id: uid(), category: "Commercial", label: "Déclaration sur l'honneur de non-conflit d'intérêt", required: false, checked: false, note: "" });

  // Dédupliquer
  const seen = new Set<string>();
  return items.filter(it => {
    const k = it.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const MOCK_RESULT: ScoringResult = {
  ao_filename: "AO-Infrastructure-Cloud-BSIC-2026.pdf",
  summary: "Cet appel d'offres porte sur la mise en place d'une infrastructure cloud hybride pour la Banque Sahélo-Saharienne d'Investissement (BSIC). Le périmètre inclut la virtualisation des serveurs existants, la mise en place d'une solution de Disaster Recovery et la formation des équipes internes. Délai de réalisation : 6 mois. Budget indicatif : 85 millions XOF.",
  key_elements: [
    { category: "Budget", value: "85 000 000 XOF" },
    { category: "Délai", value: "6 mois" },
    { category: "Date de remise", value: "15 juin 2026" },
    { category: "Secteur", value: "Banque / Finance" },
    { category: "Client / Commanditaire", value: "BSIC" },
    { category: "Compétences requises", value: "VMware, Azure, AWS, Backup & Recovery" },
    { category: "Livrables", value: "Infrastructure virtualisée, Plan DR, Formation" },
    { category: "Type de marché", value: "Services IT — Infogérance" },
  ],
  matched_documents: [
    { doc_id: "1", filename: "Offre-SGBCI-Infrastructure-2024.docx", doc_type: "offre_technique", relevance_score: 0.91, excerpt: "Migration infrastructure bancaire — virtualisation 45 serveurs, DR, SLA 99.9%" },
    { doc_id: "2", filename: "CV-Konan-Expert-Cloud.docx", doc_type: "cv", relevance_score: 0.87, excerpt: "Expert Cloud & Virtualisation — 8 ans. Certifié VMware VCP, AWS Solutions Architect" },
    { doc_id: "3", filename: "Offre-Ecobank-Datacenter-2023.docx", doc_type: "offre_technique", relevance_score: 0.82, excerpt: "Projet datacenter bancaire — Nutanix hyperconvergé, 60M XOF" },
  ],
  gaps_analysis: "Nous maîtrisons bien la virtualisation avec des références bancaires solides. Le gap principal est le cloud public (Azure/AWS) : certifications limitées à 2 ingénieurs.",
  strengths: ["Excellentes références bancaires (SGBCI, Ecobank)", "Expertise VMware confirmée", "Expérience DR et continuité d'activité", "Présence locale CI"],
  risks: [
    { label: "Certifications Azure/AWS à renforcer", criticite: "ÉLEVÉ", pourquoi: "Seuls 2 ingénieurs certifiés cloud public", mitigation: "Lancer un plan de certification ou sous-traiter le volet cloud", items_affected: ["certifications"] },
    { label: "Délai serré pour un scope large", criticite: "MODÉRÉ", pourquoi: "6 mois pour 50+ serveurs + DR + formation", mitigation: "Phasage en lots avec jalons hebdomadaires", items_affected: ["planning"] },
    { label: "Sous-estimation possible du volet formation", criticite: "MODÉRÉ", pourquoi: "Transfert de compétences obligatoire non chiffré", mitigation: "Provisionner un formateur certifié dédié", items_affected: ["methodologie"] },
  ],
  score: 78,
  recommendation: "GO",
  justification: "Profil bien adapté avec références bancaires comparables. Gap cloud public manageable avec sous-traitance partielle.",
  criteria_breakdown: [
    { id: "exp_societe", label: "Expérience et références de la société", max_points: 20, category: "Expérience", is_inferred: false, estimated_score: 18, risk_level: "FAIBLE", rationale: "Références bancaires solides (SGBCI, Ecobank)", sources_ged: ["Offre-SGBCI-Infrastructure-2024.docx"] },
    { id: "profils_cles", label: "Qualification des profils clés (CV)", max_points: 20, category: "RH", is_inferred: false, estimated_score: 14, risk_level: "MODÉRÉ", rationale: "Expert VMware confirmé, cloud public limité", sources_ged: ["CV-Konan-Expert-Cloud.docx"] },
    { id: "certifications", label: "Certifications techniques (Azure/AWS)", max_points: 15, category: "Technique", is_inferred: false, estimated_score: 8, risk_level: "ÉLEVÉ", rationale: "Seuls 2 ingénieurs certifiés cloud public", sources_ged: [] },
    { id: "methodologie", label: "Méthodologie d'intervention", max_points: 15, category: "Méthodologie", is_inferred: true, estimated_score: 12, risk_level: "MODÉRÉ", rationale: "Critère dérivé (pas de grille explicite dans l'AO)", sources_ged: [] },
    { id: "planning", label: "Planning et capacité de mobilisation", max_points: 15, category: "Méthodologie", is_inferred: true, estimated_score: 10, risk_level: "MODÉRÉ", rationale: "Délai serré pour le périmètre", sources_ged: [] },
    { id: "qualite_offre", label: "Qualité et conformité de l'offre", max_points: 15, category: "Offre", is_inferred: true, estimated_score: 13, risk_level: "FAIBLE", rationale: "Critère standard", sources_ged: [] },
  ],
  preconditions: [],
  preconditions_incomplete: false,
  criteres_selection: ["Expérience cloud hybride > 5 ans", "Certifications VMware + Azure/AWS requises", "Références bancaires CI obligatoires"].map(t => ({ texte: t })),
  besoins: ["Virtualisation infrastructure (50+ serveurs)", "Solution Disaster Recovery multi-site", "Formation équipes IT BSIC"].map(t => ({ texte: t })),
  prerequis: ["Présence locale CI obligatoire", "Capacité financière justifiée (bilan 3 ans)", "Assurance décennale active"].map(t => ({ texte: t })),
  ressources_demandees: ["Chef de projet PMP/Prince2", "Expert VMware VCP", "Architecte cloud Azure/AWS certifié", "Formateur certifié"].map(t => ({ texte: t })),
  points_vigilance: ["Clause pénalité 0.5%/semaine de retard", "Délai très court pour périmètre large", "Transfert de compétences obligatoire"].map(t => ({ texte: t })),
  date_remise: "15 juin 2026",
  profils_demandes: [
    {
      profil: "Architecte Cloud", domaine: "Infrastructure / Cloud", quantite: 2,
      niveau: "BAC+5 / Ingénieur", experience_min: "5 ans",
      competences: ["VMware vSphere", "Azure", "AWS", "Réseau & sécurité"],
      certifications: ["VMware VCP", "Azure Solutions Architect"],
      missions: ["Conception de l'architecture cible", "Pilotage de la migration"],
      rattachement: "Direction des Systèmes d'Information", source_section: "TDR §4.1",
    },
    {
      profil: "Ingénieur Virtualisation", domaine: "Infrastructure", quantite: 3,
      niveau: "BAC+4", experience_min: "3 ans",
      competences: ["VMware", "Sauvegarde & restauration", "Scripting PowerShell"],
      certifications: ["VMware VCP"], missions: ["Migration des serveurs", "Mise en place du DR"],
      rattachement: "", source_section: "TDR §4.2",
    },
    {
      profil: "Formateur certifié", domaine: "Formation", quantite: 1,
      niveau: "Senior", experience_min: "", competences: ["Pédagogie", "VMware", "Cloud"],
      certifications: ["VMware Certified Instructor"], missions: ["Transfert de compétences aux équipes BSIC"],
      rattachement: "", source_section: "TDR §4.3",
    },
  ],
  seuils_eligibilite: [
    { libelle: "Chiffre d'affaires annuel moyen (3 ans)", valeur: "300 000 000", unite: "XOF/an", type: "FINANCIER", blocking: true, source_section: "Règlement §5" },
    { libelle: "Références bancaires similaires", valeur: "3", unite: "projets", type: "REFERENCES", blocking: true, source_section: "Règlement §5" },
    { libelle: "Expérience en cloud hybride", valeur: "5", unite: "ans", type: "EXPERIENCE", blocking: false, source_section: "TDR §3" },
  ],
  donnees_financieres: {
    budget_estime: "85 000 000 XOF (indicatif)",
    modalites_paiement: "30% à la commande, 70% à la réception définitive",
    garantie_soumission: "Caution bancaire de 2% du montant de l'offre",
    penalites: "0,5% du montant par semaine de retard, plafond 10%",
    source_section: "Règlement §7",
  },
};

// ── Shared mini-components ────────────────────────────────────────────────────

function SectionCard({ title, icon, children, className, collapsible = false, defaultOpen = false, headerRight }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
  collapsible?: boolean; defaultOpen?: boolean; headerRight?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsible) {
    return (
      <div className={cn("bg-panel rounded-xl", className)}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 p-4 text-left"
        >
          {icon && <span className="text-muted shrink-0">{icon}</span>}
          <h3 className="text-sm font-semibold text-text flex-1">{title}</h3>
          {headerRight}
          <ChevronDown size={16} className={cn("text-muted shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && <div className="px-4 pb-4">{children}</div>}
      </div>
    );
  }
  return (
    <div className={cn("bg-panel rounded-xl p-4", className)}>
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        {icon && <span className="text-muted shrink-0">{icon}</span>}
        {title}
        {headerRight}
      </h3>
      {children}
    </div>
  );
}

function BulletList({ items, bulletColor = "text-ai" }: {
  items?: (string | ExtractedItem)[]; bulletColor?: string;
}) {
  if (!items?.length) return <p className="text-sm text-muted italic">Non précisé</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => {
        const ref = typeof item === "string" ? "" : (item.source_section ?? "");
        return (
          <li key={i} className="flex items-start gap-2 text-sm text-text">
            <span className={cn("mt-1 text-xs shrink-0", bulletColor)}>●</span>
            <span>
              {itemText(item)}
              {ref && <span className="ml-1 text-[11px] text-muted">· réf. {ref}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function WarningList({ items }: { items?: (string | ExtractedItem)[] }) {
  if (!items?.length) return <p className="text-sm text-muted italic">Aucun point identifié</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-warn bg-warn/10 rounded-lg px-3 py-2 border border-warn/25">
          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-warn" />
          <span>{itemText(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls =
    pct >= 70 ? "bg-good/10 text-good border-good/35"
    : pct >= 40 ? "bg-warn/10 text-warn border-warn/35"
    : "bg-bad/10 text-bad border-bad/35";
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", cls)}>
      Fiabilité {pct}%
    </span>
  );
}

function MarketIdentityCard({ identity }: { identity?: MarketIdentity }) {
  if (!identity) return null;
  const rows: { label: string; value: string }[] = [
    { label: "Type de marché", value: identity.type_marche },
    { label: "Référence", value: identity.reference },
    { label: "Autorité contractante", value: identity.autorite_contractante },
    { label: "Durée du contrat", value: identity.duree_contrat },
    { label: "Date de démarrage", value: identity.date_demarrage },
    { label: "Deadline de soumission", value: identity.deadline_soumission },
    { label: "Validité de l'offre", value: identity.validite_offre },
    { label: "Périmètre géographique", value: identity.perimetre_geographique },
    { label: "Éligibilité candidat", value: identity.eligibilite_candidat },
  ].filter(r => r.value && r.value.trim() !== "");
  if (rows.length === 0) return null;
  return (
    <div className="bg-panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <span className="text-muted shrink-0"><Briefcase size={15} /></span>
          Fiche d&apos;identité du marché
        </h3>
        <ConfidenceBadge value={identity.confidence} />
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              <td className="text-muted font-medium py-2 pr-4 w-[180px] leading-relaxed">{r.label}</td>
              <td className="text-text py-2 leading-relaxed">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarCard({ events }: { events?: CalendarEvent[] }) {
  if (!events?.length) return null;
  const critCls: Record<CalendarEvent["criticite"], string> = {
    BLOQUANT: "bg-bad/15 text-bad border-bad/35",
    CRITIQUE: "bg-warn/15 text-warn border-warn/35",
    INFO: "bg-panel-2 text-text border-line",
  };
  return (
    <SectionCard title="Calendrier de l'AO" icon={<CalendarDays size={15} />}>
      <ul className="space-y-2">
        {events.map((ev, i) => (
          <li key={i} className="flex items-start gap-3 text-sm bg-panel-2 rounded-lg px-3 py-2">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5", critCls[ev.criticite])}>
              {ev.criticite}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-text font-medium text-xs leading-relaxed">{ev.label}</div>
              <div className="text-muted text-xs mt-0.5">{ev.date}</div>
              {ev.source_section && (
                <div className="text-muted text-[10px] mt-0.5 italic">{ev.source_section}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function EvaluationModalitiesCard({ evaluation }: { evaluation?: EvaluationModalities }) {
  if (!evaluation) return null;
  const { ponderation_technique, ponderation_financiere, seuil_minimum_technique, formule_notation_financiere, modalites, confidence } = evaluation;
  const hasContent =
    ponderation_technique > 0 || ponderation_financiere > 0 || seuil_minimum_technique > 0 ||
    !!formule_notation_financiere || (modalites?.length ?? 0) > 0;
  if (!hasContent) return null;
  return (
    <div className="bg-panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <span className="text-muted shrink-0"><Scale size={15} /></span>
          Modalités d&apos;évaluation
        </h3>
        <ConfidenceBadge value={confidence} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
        <div className="bg-[#ececee] rounded-lg p-3">
          <div className="text-[10px] font-medium text-ai uppercase tracking-wide">Pondération technique</div>
          {ponderation_technique > 0 ? (
            <div className="text-2xl font-bold text-ai mt-1">{ponderation_technique}<span className="text-sm font-medium">%</span></div>
          ) : (
            <div className="text-sm font-medium text-muted italic mt-2">Non précisé dans l&apos;AO</div>
          )}
        </div>
        <div className="bg-teal-50 rounded-lg p-3">
          <div className="text-[10px] font-medium text-teal-700 uppercase tracking-wide">Pondération financière</div>
          {ponderation_financiere > 0 ? (
            <div className="text-2xl font-bold text-teal-700 mt-1">{ponderation_financiere}<span className="text-sm font-medium">%</span></div>
          ) : (
            <div className="text-sm font-medium text-muted italic mt-2">Non précisé dans l&apos;AO</div>
          )}
        </div>
        <div className="bg-panel-2 rounded-lg p-3">
          <div className="text-[10px] font-medium text-muted uppercase tracking-wide">Seuil minimum technique</div>
          {seuil_minimum_technique > 0 ? (
            <div className="text-2xl font-bold text-text mt-1">{seuil_minimum_technique}<span className="text-sm font-medium">/100</span></div>
          ) : (
            <div className="text-sm font-medium text-muted italic mt-2">Non précisé dans l&apos;AO</div>
          )}
        </div>
      </div>
      {formule_notation_financiere && (
        <div className="text-sm bg-panel-2 rounded-lg p-2.5 mb-2">
          <span className="text-muted font-medium text-xs">Formule notation financière&nbsp;: </span>
          <span className="text-text font-mono text-xs">{formule_notation_financiere}</span>
        </div>
      )}
      {modalites?.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted mb-1.5">Modalités complémentaires</div>
          <BulletList items={modalites} bulletColor="text-muted" />
        </div>
      )}
    </div>
  );
}

function RequiredProfilesCard({ profils }: { profils?: RequiredProfile[] }) {
  if (!profils?.length) return null;
  const totalPostes = profils.reduce((s, p) => s + (p.quantite || 0), 0);
  return (
    <SectionCard
      title={`Profils demandés (${profils.length})`}
      icon={<Briefcase size={15} />}
      collapsible
      headerRight={totalPostes > 0 ? (
        <span className="text-[11px] font-bold text-text bg-panel-2 border border-line rounded-full px-2.5 py-0.5 shrink-0">
          {totalPostes} poste{totalPostes > 1 ? "s" : ""} au total
        </span>
      ) : undefined}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed text-xs border border-line border-collapse">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[5%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[34%]" />
          </colgroup>
          <thead>
            <tr className="bg-panel-2 text-left text-[10px] uppercase tracking-wide text-muted">
              <th className="border border-line font-medium px-3 py-2">Profil</th>
              <th className="border border-line font-medium px-3 py-2 text-center">Nb</th>
              <th className="border border-line font-medium px-3 py-2">Niveau / Exp.</th>
              <th className="border border-line font-medium px-3 py-2">Compétences</th>
              <th className="border border-line font-medium px-3 py-2">Certifications</th>
              <th className="border border-line font-medium px-3 py-2">Missions</th>
            </tr>
          </thead>
          <tbody>
            {profils.map((p, i) => (
              <tr key={i} className="align-top">
                <td className="border border-line px-3 py-2 break-words">
                  <div className="font-semibold text-text leading-snug">{p.profil}</div>
                  {p.domaine && <div className="text-muted mt-0.5">{p.domaine}</div>}
                  {p.rattachement && <div className="text-muted italic mt-0.5">{p.rattachement}</div>}
                </td>
                <td className="border border-line px-2 py-2 text-center font-semibold text-text whitespace-nowrap">
                  {p.quantite > 0 ? `${p.quantite}×` : "—"}
                </td>
                <td className="border border-line px-3 py-2 text-text leading-relaxed break-words">
                  {[p.niveau, p.experience_min].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="border border-line px-3 py-2">
                  {p.competences?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.competences.map((c, j) => (
                        <span key={j} className="inline-block px-1.5 py-0.5 rounded bg-panel-2 text-text text-[10px] break-words">{c}</span>
                      ))}
                    </div>
                  ) : <span className="text-line">—</span>}
                </td>
                <td className="border border-line px-3 py-2">
                  {p.certifications?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.certifications.map((c, j) => (
                        <span key={j} className="inline-block px-1.5 py-0.5 rounded bg-good/10 text-good text-[10px] break-words">{c}</span>
                      ))}
                    </div>
                  ) : <span className="text-line">—</span>}
                </td>
                <td className="border border-line px-3 py-2 text-text leading-relaxed">
                  {p.missions?.length > 0 ? (
                    <ul className="space-y-0.5">
                      {p.missions.map((m, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <span className="mt-0.5 text-line shrink-0">›</span><span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-line">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function EligibilityThresholdsCard({ seuils }: { seuils?: EligibilityThreshold[] }) {
  if (!seuils?.length) return null;
  return (
    <div className="bg-panel rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <span className="text-muted shrink-0"><Scale size={15} /></span>
        Seuils d&apos;éligibilité ({seuils.length})
      </h3>
      <div className="space-y-2">
        {seuils.map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-panel-2 p-2.5">
            {s.blocking && (
              <span className="text-[10px] font-bold text-bad bg-bad/10 border border-bad/35 rounded px-1.5 py-0.5 shrink-0">
                ÉLIMINATOIRE
              </span>
            )}
            <span className="text-sm text-text flex-1">{s.libelle}</span>
            <span className="text-sm font-bold text-text whitespace-nowrap">
              {s.valeur}{s.unite && <span className="text-xs font-medium text-muted"> {s.unite}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialDataCard({ data }: { data?: FinancialData }) {
  if (!data) return null;
  const rows: [string, string][] = [
    ["Budget estimé", data.budget_estime],
    ["Modalités de paiement", data.modalites_paiement],
    ["Garantie de soumission", data.garantie_soumission],
    ["Pénalités", data.penalites],
  ].filter(([, v]) => !!v) as [string, string][];
  if (!rows.length) return null;
  return (
    <div className="bg-panel rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <span className="text-muted shrink-0"><Coins size={15} /></span>
        Données financières
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map(([label, value], i) => (
          <div key={i} className="bg-panel-2 rounded-lg p-2.5">
            <div className="text-[10px] font-medium text-muted uppercase tracking-wide">{label}</div>
            <div className="text-sm text-text font-medium mt-0.5">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecoBadge({ rec }: { rec: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    GO: { cls: "bg-good/15 text-good border-good/45", label: "GO ✓" },
    CONDITIONAL: { cls: "bg-warn/15 text-warn border-warn/45", label: "CONDITIONNEL ⚡" },
    NO_BID: { cls: "bg-bad/15 text-bad border-bad/45", label: "NO-BID ✗" },
  };
  const { cls, label } = map[rec] ?? map.CONDITIONAL;
  return (
    <span className={cn("inline-block px-3 py-1 rounded-full text-sm font-semibold border", cls)}>
      {label}
    </span>
  );
}

function DecisionBtn({ label, colorKey, selected, onClick }: {
  label: string; colorKey: "green" | "amber" | "red"; selected: boolean; onClick: () => void;
}) {
  const base = {
    green: "border-good/35 text-good hover:bg-good/10 hover:border-good/55",
    amber: "border-warn/35 text-warn hover:bg-warn/10 hover:border-warn/55",
    red: "border-bad/35 text-bad hover:bg-bad/10 hover:border-bad/55",
  };
  const sel = {
    green: "bg-good/15 border-good text-good font-bold",
    amber: "bg-warn/15 border-warn text-warn font-bold",
    red: "bg-bad/15 border-bad text-bad font-bold",
  };
  return (
    <button
      onClick={onClick}
      className={cn("flex-1 py-3 px-3 border-2 rounded-xl text-sm transition-all", selected ? sel[colorKey] : base[colorKey])}
    >
      {label}
    </button>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 38;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? "#0ea37a" : score >= 40 ? "#c77d00" : "#d64545";
  const textColor = score >= 70 ? "text-good" : score >= 40 ? "text-warn" : "text-bad";

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 104, height: 104 }}>
      <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
        <circle cx="52" cy="52" r={radius} fill="none" stroke="#deded7" strokeWidth={stroke} />
        <circle
          cx="52" cy="52" r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className={cn("text-3xl font-bold leading-none", textColor)}>{score}</span>
        <span className="text-xs text-muted block mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ── Décomposition du score : grille d'évaluation détaillée ──────────────────────

const RISK_LEVEL_STYLE: Record<string, string> = {
  FAIBLE: "bg-good/15 text-good",
  "MODÉRÉ": "bg-warn/15 text-warn",
  "ÉLEVÉ": "bg-ai/15 text-warn",
  CRITIQUE: "bg-bad/15 text-bad",
};
const RISK_LEVEL_BAR: Record<string, string> = {
  FAIBLE: "bg-good",
  "MODÉRÉ": "bg-warn",
  "ÉLEVÉ": "bg-ai",
  CRITIQUE: "bg-bad",
};

function ScoreBreakdown({ criteria }: { criteria: ScoringCriterion[] }) {
  if (!criteria.length) {
    return <p className="text-sm text-muted italic">Pas de grille d'évaluation décomposée disponible.</p>;
  }
  const totalMax = criteria.reduce((s, c) => s + c.max_points, 0);
  const totalEst = criteria.reduce((s, c) => s + c.estimated_score, 0);
  return (
    <div className="space-y-3">
      {criteria.map((c) => {
        const pct = c.max_points > 0 ? (c.estimated_score / c.max_points) * 100 : 0;
        return (
          <div key={c.id}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className={cn("text-sm text-text", c.is_inferred && "italic text-muted")}>
                {c.label}
                {c.is_inferred && (
                  <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-panel-2 text-muted not-italic align-middle">
                    estimé
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-text shrink-0">
                {c.estimated_score}/{c.max_points}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-panel-2 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", RISK_LEVEL_BAR[c.risk_level] ?? "bg-muted")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", RISK_LEVEL_STYLE[c.risk_level] ?? "bg-panel-2 text-muted")}>
                {c.risk_level}
              </span>
            </div>
            {c.rationale && <p className="text-[11px] text-muted mt-0.5">{c.rationale}</p>}
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-2 mt-1 border-t border-line">
        <span className="text-sm font-semibold text-text">Total estimé</span>
        <span className="text-sm font-bold text-text">{totalEst} / {totalMax} pts</span>
      </div>
    </div>
  );
}

// ── Liste des risques structurés (triés par criticité) ──────────────────────────

const CRITICITE_ORDER: Record<string, number> = { BLOQUANT: 0, CRITIQUE: 1, "ÉLEVÉ": 2, "MODÉRÉ": 3 };
const CRITICITE_STYLE: Record<string, string> = {
  BLOQUANT: "bg-bad/25 text-bad",
  CRITIQUE: "bg-bad/15 text-bad",
  "ÉLEVÉ": "bg-ai/15 text-warn",
  "MODÉRÉ": "bg-warn/15 text-warn",
};
const CRITICITE_BORDER: Record<string, string> = {
  BLOQUANT: "border-bad/45",
  CRITIQUE: "border-bad/35",
  "ÉLEVÉ": "border-ai/35",
  "MODÉRÉ": "border-warn/35",
};

function RiskList({ risks }: { risks: Risk[] }) {
  if (!risks?.length) return <p className="text-sm text-muted italic">Aucun risque identifié.</p>;
  const sorted = [...risks].sort(
    (a, b) => (CRITICITE_ORDER[a.criticite] ?? 9) - (CRITICITE_ORDER[b.criticite] ?? 9)
  );
  return (
    <ul className="space-y-2.5">
      {sorted.map((r, i) => (
        <li key={i} className={cn("rounded-lg border p-2.5 bg-panel", CRITICITE_BORDER[r.criticite] ?? "border-line")}>
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-text">{r.label}</span>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", CRITICITE_STYLE[r.criticite] ?? "bg-panel-2 text-muted")}>
              {r.criticite}
            </span>
          </div>
          {r.pourquoi && <p className="text-[11px] text-muted mt-1">{r.pourquoi}</p>}
          {r.mitigation ? (
            <p className="text-[11px] text-good mt-1 flex items-start gap-1">
              <Shield size={12} className="mt-0.5 shrink-0" />
              <span>{r.mitigation}</span>
            </p>
          ) : (
            <p className="text-[11px] text-warn italic mt-1">Mitigation à définir</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Checklist des préalables conditionnels (interactive) ─────────────────────────

const PRECOND_TYPE_STYLE: Record<string, string> = {
  FINANCIER: "bg-good/15 text-good",
  ADMIN: "bg-[#ececee] text-ai",
  TECHNIQUE: "bg-panel-2 text-text",
  PARTENARIAT: "bg-warn/15 text-warn",
};

function PreconditionChecklist({ preconditions, incomplete }: {
  preconditions: Precondition[]; incomplete?: boolean;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  if (!preconditions?.length) {
    return (
      <p className="text-sm text-warn italic">
        {incomplete
          ? "Recommandation conditionnelle sans préalables explicites — à compléter manuellement."
          : "Aucun préalable listé."}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {preconditions.map((p, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <button
            onClick={() => setChecked((s) => ({ ...s, [i]: !s[i] }))}
            className={cn(
              "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
              checked[i] ? "bg-good border-good" : "bg-panel border-line hover:border-line"
            )}
            aria-label={checked[i] ? "Décocher" : "Cocher"}
          >
            {checked[i] && <CheckCircle size={12} className="text-white" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("text-sm text-text", checked[i] && "line-through text-muted")}>
                {p.label}
              </span>
              {p.blocking && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-bad/15 text-bad">bloquant</span>
              )}
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", PRECOND_TYPE_STYLE[p.type] ?? "bg-panel-2 text-muted")}>
                {p.type}
              </span>
            </div>
            {(p.deadline || p.responsable) && (
              <p className="text-[11px] text-muted mt-0.5">
                {[p.deadline, p.responsable].filter(Boolean).join(" · ")}
              </p>
            )}
            {(p.pieces_requises?.length ?? 0) > 0 && (
              <p className="text-[11px] text-muted mt-0.5">
                Pièces : {p.pieces_requises!.join(", ")}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Vue des phases du plan de réponse ────────────────────────────────────────────

function PhasesView({ phases }: { phases: StrategyPhase[] }) {
  if (!phases?.length) return <p className="text-sm text-muted italic">Aucune phase définie.</p>;
  return (
    <div className="space-y-4">
      {phases.map((ph) => (
        <div key={ph.id} className="border-l-2 border-[#deded7] pl-3">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-semibold text-text">{ph.name}</span>
            {ph.start_day && (
              <span className="text-[11px] text-muted">
                {ph.start_day}{ph.end_day && ph.end_day !== ph.start_day ? `→${ph.end_day}` : ""}
              </span>
            )}
            {ph.is_blocking_next && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-bad/15 text-bad">bloquante</span>
            )}
          </div>
          {ph.actions.length === 0 ? (
            <p className="text-[11px] text-muted italic">Actions à préciser.</p>
          ) : (
            <ul className="space-y-1.5">
              {ph.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[11px] font-semibold text-ai shrink-0 mt-0.5 w-9">{a.day_label}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-text">{a.action}</span>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {a.responsable && <span className="text-[11px] text-muted">{a.responsable}</span>}
                      {a.deliverable && <span className="text-[11px] text-good">→ {a.deliverable}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Checklist des pièces & annexes (statut cyclable) ─────────────────────────────

const APPENDIX_STATUT_CYCLE = ["PENDING", "EN_COURS", "OK", "NOK"] as const;
const APPENDIX_STATUT_STYLE: Record<string, string> = {
  PENDING: "bg-panel-2 text-muted",
  EN_COURS: "bg-warn/15 text-warn",
  OK: "bg-good/15 text-good",
  NOK: "bg-bad/15 text-bad",
};
const APPENDIX_TYPE_STYLE: Record<string, string> = {
  ADMIN: "bg-[#ececee] text-ai",
  TECHNIQUE: "bg-panel-2 text-text",
  FINANCIER: "bg-good/15 text-good",
  RH: "bg-warn/15 text-warn",
};

function AppendixChecklist({ appendices }: { appendices: Appendix[] }) {
  // Statut local cyclable (suivi visuel ; futur : persistance + export du statut édité)
  const [statuts, setStatuts] = useState<Record<number, string>>({});
  const [filterResp, setFilterResp] = useState<string>("");
  if (!appendices?.length) return <p className="text-sm text-muted italic">Aucune pièce listée dans l'AO.</p>;

  const responsables = Array.from(new Set(appendices.map(a => a.responsable).filter(Boolean)));
  const statutOf = (i: number) => statuts[i] ?? appendices[i].statut ?? "PENDING";
  const cycle = (i: number) =>
    setStatuts(s => {
      const cur = statutOf(i);
      const next = APPENDIX_STATUT_CYCLE[(APPENDIX_STATUT_CYCLE.indexOf(cur as never) + 1) % APPENDIX_STATUT_CYCLE.length];
      return { ...s, [i]: next };
    });

  return (
    <div className="space-y-2">
      {responsables.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] mb-1">
          <span className="text-muted">Filtrer par responsable :</span>
          <button onClick={() => setFilterResp("")}
            className={cn("px-1.5 py-0.5 rounded-full", filterResp === "" ? "bg-ai text-white" : "bg-panel-2 text-muted")}>
            tous
          </button>
          {responsables.map(r => (
            <button key={r} onClick={() => setFilterResp(r)}
              className={cn("px-1.5 py-0.5 rounded-full", filterResp === r ? "bg-ai text-white" : "bg-panel-2 text-muted")}>
              {r}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {appendices.map((a, i) => (filterResp && a.responsable !== filterResp) ? null : (
          <li key={i} className="flex items-start gap-2.5">
            <button
              onClick={() => cycle(i)}
              className={cn("mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 w-20 text-center",
                APPENDIX_STATUT_STYLE[statutOf(i)] ?? "bg-panel-2 text-muted")}
              title="Cliquer pour changer le statut"
            >
              {statutOf(i)}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {a.code && a.code !== "—" && <span className="text-[11px] font-semibold text-muted">{a.code}</span>}
                <span className="text-sm text-text">{a.label}</span>
                {!a.obligatoire && <span className="text-[10px] text-muted italic">(facultatif)</span>}
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", APPENDIX_TYPE_STYLE[a.type] ?? "bg-panel-2 text-muted")}>
                  {a.type}
                </span>
              </div>
              {(a.responsable || a.source_section) && (
                <p className="text-[11px] text-muted mt-0.5">
                  {[a.responsable, a.source_section].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

const STEPS_P1 = [
  { num: 1, label: "Analyse AO" },
  { num: 2, label: "Score & Décision" },
  { num: 3, label: "Stratégie" },
];
const STEPS_P2 = [
  { num: 5, label: "Offre technique" },
  { num: 6, label: "Checklist dossier" },
  { num: 7, label: "Soumission" },
];

const STEP_LABELS: Record<number, string> = {
  1: "Analyse AO",
  2: "Score & Décision",
  3: "Stratégie",
  4: "Plan de réponse",
  5: "Offre technique",
  6: "Checklist dossier",
  7: "Soumission",
};

// ── Helpers pour le tableau d'historique (page d'accueil) ───────────────────────
function dossierProgress(ao: AOEntry): number {
  if (ao.status !== "scored") return 0;
  if (ao.submissionValidated || ao.result) return 100;
  return Math.round(((getActiveStep(ao) - 1) / 6) * 100);
}

function dossierStatut(ao: AOEntry): { label: string; cls: string } {
  if (ao.status === "pending_analysis") return { label: "En attente d'analyse", cls: "bg-panel-2 text-muted" };
  if (ao.status === "scoring") return { label: "Analyse en cours", cls: "bg-[#ececee] text-ai" };
  if (ao.status === "error") return { label: "Erreur", cls: "bg-bad/15 text-bad" };
  if (ao.result === "won") return { label: "Gagné", cls: "bg-good/15 text-good" };
  if (ao.result === "lost") return { label: "Perdu", cls: "bg-bad/15 text-bad" };
  if (ao.result === "pending" || ao.submissionValidated) return { label: "Soumis", cls: "bg-[#ececee] text-ai" };
  if (ao.decision === "no_bid" && ao.decisionValidated) return { label: "NO-BID", cls: "bg-bad/15 text-bad" };
  const step = getActiveStep(ao);
  return { label: `Étape ${step} — ${STEP_LABELS[step]}`, cls: "bg-warn/15 text-warn" };
}

function dossierMontant(ao: AOEntry): string | null {
  const fin = ao.scoringResult?.donnees_financieres?.budget_estime;
  if (fin) return fin;
  const ke = ao.scoringResult?.key_elements?.find(k => /budget|montant|estimation|valeur/i.test(k.category));
  return ke?.value ?? null;
}

function dossierEcheance(ao: AOEntry): string {
  return (
    ao.deadline ||
    ao.scoringResult?.date_remise ||
    ao.scoringResult?.market_identity?.deadline_soumission ||
    "—"
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition border",
        active
          ? "bg-ai text-white border-ai"
          : "bg-panel text-muted border-line hover:border-ai"
      )}
    >
      {label}
      <span
        className={cn(
          "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
          active ? "bg-white/20" : "bg-panel-2 text-muted"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StepperBar({ ao, viewStep, onStepClick, steps }: {
  ao: AOEntry; viewStep: number;
  onStepClick: (s: number) => void;
  steps: { num: number; label: string }[];
}) {
  return (
    <div className="flex items-center px-6 py-3 bg-ink gap-1 shrink-0">
      {steps.map((step, idx) => {
        const accessible = canViewStep(ao, step.num);
        const done = isStepDone(ao, step.num);
        const current = viewStep === step.num;
        return (
          <React.Fragment key={step.num}>
            <button
              onClick={() => accessible && onStepClick(step.num)}
              disabled={!accessible}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors shrink-0",
                accessible && !current ? "hover:bg-panel-2 cursor-pointer" : "",
                !accessible ? "cursor-not-allowed" : ""
              )}
            >
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                done && !current ? "bg-good text-white" :
                current ? "bg-ai text-white" :
                accessible ? "border-2 border-line text-muted" :
                "bg-panel-2 text-muted"
              )}>
                {done && !current ? "✓" : step.num}
              </span>
              <span className={cn(
                "text-xs font-medium transition-colors",
                current ? "text-ai" :
                done ? "text-good" :
                accessible ? "text-text" :
                "text-muted"
              )}>
                {step.label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 min-w-[12px] rounded-full transition-colors",
                isStepDone(ao, step.num) ? "bg-good/40" : "bg-line"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step content ──────────────────────────────────────────────────────────────

function Step1({ ao, onExport, exporting, onExportMatrix, exportingMatrix, onNext, onReanalyze }: {
  ao: AOEntry; onExport: () => void; exporting: boolean;
  onExportMatrix: () => void; exportingMatrix: boolean; onNext: () => void; onReanalyze: () => void;
}) {
  const r = ao.scoringResult!;
  return (
    <div className="space-y-4">
      <MarketIdentityCard identity={r.market_identity} />

      <SectionCard title="Résumé exécutif" icon={<FileText size={15} />} collapsible>
        <div className="prose prose-sm max-w-none text-text leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.summary}</ReactMarkdown>
        </div>
      </SectionCard>

      <CalendarCard events={r.calendar} />

      {(r.key_elements?.length ?? 0) > 0 && (
        <SectionCard title="Points clés identifiés" icon={<BarChart2 size={15} />} collapsible>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-line">
              {r.key_elements.map((el, i) => (
                <tr key={i} className="align-top">
                  <td className="text-muted font-medium py-2 pr-4 w-[180px] leading-relaxed">{el.category}</td>
                  <td className="text-text py-2 leading-relaxed">{el.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      <EvaluationModalitiesCard evaluation={r.evaluation_modalities} />

      {(r.criteres_selection?.length ?? 0) > 0 && (
        <SectionCard title="Critères de sélection" icon={<ClipboardList size={15} />}>
          <BulletList items={r.criteres_selection} bulletColor="text-ai" />
        </SectionCard>
      )}

      {(r.besoins?.length ?? 0) > 0 && (
        <SectionCard title="Besoins identifiés" icon={<Target size={15} />} collapsible>
          <BulletList items={r.besoins} bulletColor="text-teal-600" />
        </SectionCard>
      )}

      {(r.prerequis?.length ?? 0) > 0 && (
        <SectionCard title="Prérequis" icon={<Shield size={15} />}>
          <BulletList items={r.prerequis} bulletColor="text-muted" />
        </SectionCard>
      )}

      <RequiredProfilesCard profils={r.profils_demandes} />

      {(r.profils_demandes?.length ?? 0) === 0 && (r.ressources_demandees?.length ?? 0) > 0 && (
        <SectionCard title="Ressources demandées" icon={<Users size={15} />}>
          <BulletList items={r.ressources_demandees} bulletColor="text-muted" />
        </SectionCard>
      )}

      <EligibilityThresholdsCard seuils={r.seuils_eligibilite} />

      <FinancialDataCard data={r.donnees_financieres} />

      {(r.points_vigilance?.length ?? 0) > 0 && (
        <SectionCard title="Points de vigilance" icon={<Eye size={15} />}>
          <WarningList items={r.points_vigilance} />
        </SectionCard>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-panel-2 text-text rounded-lg text-sm font-medium border border-line hover:border-line disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exporter en Word
          </button>
          <button
            onClick={onExportMatrix}
            disabled={exportingMatrix}
            title="Matrice de conformité exhaustive (toutes les exigences, classées par domaine, avec leur référence source) — Excel"
            className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-panel-2 text-good rounded-lg text-sm font-medium border border-good/35 hover:border-good/45 disabled:opacity-50 transition-colors"
          >
            {exportingMatrix ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
            Matrice de conformité
          </button>
          <button
            onClick={onReanalyze}
            title="Relancer une analyse fraîche de l'AO (ignore le cache)"
            className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-panel-2 text-muted rounded-lg text-sm font-medium border border-line hover:border-ai hover:text-ai transition-colors"
          >
            <Play size={14} /> Refaire l&apos;analyse
          </button>
        </div>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2 bg-ai hover:brightness-95 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Score & Décision
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Step2({ ao, onUpdate, onValidate, validating, onExport, exporting }: {
  ao: AOEntry;
  onUpdate: (patch: Partial<AOEntry>) => void;
  onValidate: () => void;
  validating: boolean;
  onExport: () => void;
  exporting: boolean;
}) {
  const r = ao.scoringResult!;

  const docTypeLabel: Record<string, string> = {
    cv: "CV", offre_technique: "Offre", abe: "ABE", pv_recette: "PV recette",
  };
  const docTypeColor: Record<string, string> = {
    cv: "bg-panel-2 text-text",
    offre_technique: "bg-[#ececee] text-ai",
    abe: "bg-warn/15 text-warn",
    pv_recette: "bg-good/15 text-good",
  };

  const teamMatches = r.team_matches ?? [];
  const similarProjects = r.similar_projects ?? [];

  return (
    <div className="space-y-4">
      {/* Score principal */}
      <SectionCard title="Score de matching GED" icon={<Layers size={15} />}>
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={r.score} />
            {r.score_basis === "ESTIME" && (
              <span className="text-[11px] text-warn font-medium text-center max-w-[120px]">
                Estimé — AO sans barème chiffré
              </span>
            )}
            {r.score_basis === "INDISPONIBLE" && (
              <span className="text-[11px] text-bad font-medium text-center max-w-[120px]">
                Score indisponible — analyse à relancer
              </span>
            )}
          </div>
          <div className="space-y-3 flex-1 min-w-[200px]">
            <RecoBadge rec={r.recommendation} />
            {r.justification && !r.justification.startsWith("{") && !r.justification.startsWith("```") && (
              <p className="text-sm text-text leading-relaxed">{r.justification}</p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Matching équipe — CVs depuis la GED */}
      <SectionCard
        title={`Équipe proposable (${teamMatches.length} CV${teamMatches.length !== 1 ? "s" : ""} matchés)`}
        icon={<Users size={15} className="text-muted" />}
      >
        {teamMatches.length === 0 ? (
          <p className="text-xs text-muted italic py-1">
            {(r.ressources_demandees?.length ?? 0) > 0
              ? "Aucun CV correspondant dans la GED pour ces profils."
              : "L'AO ne précise pas de profils spécifiques."}
          </p>
        ) : (
          <div className="space-y-2">
            {(r.ressources_demandees?.length ?? 0) > 0 && (
              <p className="text-[11px] text-muted italic mb-2">
                Profils demandés : {r.ressources_demandees!.slice(0, 4).map(itemText).join(" · ")}
              </p>
            )}
            {teamMatches.map((doc, i) => {
              const name = doc.filename
                .replace(/\.(docx?|pdf)$/i, "")
                .replace(/[-_]/g, " ")
                .replace(/^cv\s*/i, "")
                .trim()
                .replace(/\b\w/g, c => c.toUpperCase());
              const initials = name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase();
              return (
                <div key={i} className="flex items-start gap-3 p-2.5 bg-panel-2 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-line flex items-center justify-center shrink-0 text-[10px] font-bold text-text">
                    {initials || "CV"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text truncate">{name}</span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{doc.excerpt}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Projets similaires — offres / ABE / PV recette */}
      <SectionCard
        title={`Projets similaires dans la GED (${similarProjects.length})`}
        icon={<FileText size={15} className="text-ai" />}
      >
        {similarProjects.length === 0 ? (
          <p className="text-xs text-muted italic py-1">Aucun projet similaire trouvé dans la GED.</p>
        ) : (
          <div className="space-y-2">
            {similarProjects.map((doc, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 bg-[#ececee] rounded-lg">
                <div className="w-7 h-7 rounded-lg bg-[#ececee] flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-ai" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text truncate">{doc.filename}</span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium",
                      docTypeColor[doc.doc_type] ?? "bg-panel-2 text-muted"
                    )}>
                      {docTypeLabel[doc.doc_type] ?? doc.doc_type}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">{doc.excerpt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Grille d'évaluation décomposée */}
      {(r.criteria_breakdown?.length ?? 0) > 0 && (
        <SectionCard title="Grille d'évaluation détaillée" icon={<BarChart2 size={15} className="text-ai" />} collapsible>
          <ScoreBreakdown criteria={r.criteria_breakdown!} />
        </SectionCard>
      )}

      {/* Préalables conditionnels — uniquement si CONDITIONAL */}
      {r.recommendation === "CONDITIONAL" && (
        <SectionCard title="Préalables conditionnels" icon={<ClipboardList size={15} className="text-warn" />} className="border-warn/25">
          <PreconditionChecklist preconditions={r.preconditions ?? []} incomplete={r.preconditions_incomplete} />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionCard title="Nos forces" icon={<CheckCircle size={15} />} className="border-good/25">
          <BulletList items={r.strengths} bulletColor="text-good" />
        </SectionCard>
        <SectionCard title="Risques & mitigation" icon={<AlertTriangle size={15} />} className="border-bad/25" collapsible>
          <RiskList risks={r.risks} />
        </SectionCard>
      </div>

      {r.gaps_analysis && !r.gaps_analysis.startsWith("{") && !r.gaps_analysis.startsWith("```") && (
        <SectionCard title="Analyse des écarts">
          <NumberedAnalysis text={r.gaps_analysis} />
        </SectionCard>
      )}

      <div className="flex justify-end">
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-panel-2 text-text rounded-lg text-sm font-medium border border-line hover:border-line disabled:opacity-50 transition-colors"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exporter le scoring
        </button>
      </div>

      {!ao.decisionValidated ? (
        <SectionCard title="Ma décision commerciale" className="border-[#deded7] bg-[#ececee]/30">
          <p className="text-xs text-muted mb-3">Sur la base de l'analyse, quelle est votre décision ?</p>
          <div className="flex gap-3 mb-4">
            <DecisionBtn label="GO ✓" colorKey="green" selected={ao.decision === "go"} onClick={() => onUpdate({ decision: "go" })} />
            <DecisionBtn label="CONDITIONNEL ⚡" colorKey="amber" selected={ao.decision === "conditional"} onClick={() => onUpdate({ decision: "conditional" })} />
            <DecisionBtn label="NO-BID ✗" colorKey="red" selected={ao.decision === "no_bid"} onClick={() => onUpdate({ decision: "no_bid" })} />
          </div>
          <textarea
            value={ao.decisionReason}
            onChange={e => onUpdate({ decisionReason: e.target.value })}
            placeholder="Justification de la décision (optionnel)..."
            className="w-full text-sm border border-line rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/25 bg-panel"
            rows={2}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={onValidate}
              disabled={!ao.decision || validating}
              className="flex items-center gap-2 px-5 py-2 bg-ai hover:brightness-95 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {validating && <Loader2 size={14} className="animate-spin" />}
              {validating ? "Génération en cours..." : "Valider ma décision"}
              {!validating && <ArrowRight size={14} />}
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Décision validée" className="border-good/35 bg-good/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-good/15 flex items-center justify-center shrink-0">
              <CheckCircle size={18} className="text-good" />
            </div>
            <div>
              <span className="font-semibold text-text">
                {ao.decision === "go" ? "GO — Répondre à cet AO" : ao.decision === "conditional" ? "CONDITIONNEL — Sous réserve" : "NO-BID — Ne pas répondre"}
              </span>
              {ao.decisionReason && (
                <p className="text-sm text-muted mt-0.5">{ao.decisionReason}</p>
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function Step3({ ao, generatingStrategy, onValidate, onExport, exporting, onRegenerate }: {
  ao: AOEntry;
  generatingStrategy: boolean;
  onValidate: () => void;
  onExport: () => void;
  exporting: boolean;
  onRegenerate: () => void;
}) {
  if (generatingStrategy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div className="w-16 h-16 rounded-xl bg-[#ececee] flex items-center justify-center">
          <Sparkles size={32} className="text-ai animate-pulse" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-text">Génération de la stratégie de réponse...</p>
          <p className="text-sm text-muted mt-1.5">L&apos;IA analyse votre AO et vos références GED</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-line animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!ao.bidStrategy) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertCircle size={40} className="text-warn" />
        <p className="text-muted">La génération de la stratégie a échoué.</p>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-2 px-5 py-2 bg-ai hover:brightness-95 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Sparkles size={14} /> Refaire la génération
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(ao.bidStrategy.partner_validation?.length ?? 0) > 0 && (
        <SectionCard
          title={ao.bidStrategy.partner
            ? `Validation partenaire — ${ao.bidStrategy.partner.name} (étape 0)`
            : "Préalables à lever (étape 0)"}
          icon={<Scale size={15} className="text-warn" />}
          className="border-warn/25"
        >
          <PreconditionChecklist preconditions={ao.bidStrategy.partner_validation} />
        </SectionCard>
      )}

      {(ao.bidStrategy.phases?.length ?? 0) > 0 && (
        <SectionCard title="Plan de réponse en phases" icon={<ClipboardList size={15} />} collapsible>
          <PhasesView phases={ao.bidStrategy.phases} />
        </SectionCard>
      )}

      {(ao.bidStrategy.appendices?.length ?? 0) > 0 && (
        <SectionCard title="Pièces & annexes à fournir" icon={<FileText size={15} className="text-ai" />} collapsible>
          <AppendixChecklist appendices={ao.bidStrategy.appendices} />
        </SectionCard>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-panel-2 text-text rounded-xl text-sm font-medium border border-line hover:border-line disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exporter en Word
          </button>
          <button
            onClick={onRegenerate}
            title="Relancer la génération de la stratégie"
            className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-panel-2 text-muted rounded-xl text-sm font-medium border border-line hover:border-ai hover:text-ai transition-colors"
          >
            <Sparkles size={14} /> Refaire la génération
          </button>
        </div>

        {!ao.strategyValidated ? (
          <button
            onClick={onValidate}
            className="flex items-center gap-2 px-5 py-2 bg-ai hover:brightness-95 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <CheckCircle size={14} />
            Valider la stratégie → Phase 2
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-good text-sm font-medium bg-good/10 rounded-xl px-4 py-2.5 border border-good/25">
            <CheckCircle size={16} /> Stratégie validée
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal de sélection des documents (CV / ABE) avant génération de l'offre ─────

function DocPicker({ label, icon, folder, accentClass, selected, onToggle }: {
  label: string;
  icon: React.ReactNode;
  folder: "cvs" | "abe";
  accentClass: string;
  selected: string[];
  onToggle: (filename: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [files, setFiles] = useState<GEDFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGEDFiles(folder);
      setFiles(res.files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  };
  // Chargement initial : setState uniquement dans les callbacks de promesse
  // (règle react-hooks : pas de setState synchrone dans un effet).
  useEffect(() => {
    let cancelled = false;
    fetchGEDFiles(folder)
      .then((res) => { if (!cancelled) setFiles(res.files); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // `folder` est fixe pour une instance du modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadGEDFile(file, folder);
      await load();
      if (!selected.includes(res.filename)) onToggle(res.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Téléversement impossible");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = files.filter(f => f.filename.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-panel-2 hover:bg-panel-2 transition-colors"
      >
        <span className="text-muted shrink-0">{icon}</span>
        <span className="text-sm font-semibold text-text">{label}</span>
        {selected.length > 0 && (
          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", accentClass)}>
            {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
          </span>
        )}
        <ChevronDown size={16} className={cn("ml-auto text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher un document…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20"
              />
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ai bg-panel border border-line rounded-lg hover:bg-panel-2 disabled:opacity-50 shrink-0"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Téléverser
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-2 bg-bad/10 border border-bad/35 rounded-lg text-xs text-bad">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-xs text-muted py-4">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted italic py-4 text-center">
                {files.length === 0
                  ? "Aucun document dans la GED — téléversez-en un."
                  : "Aucun résultat pour cette recherche."}
              </p>
            ) : (
              filtered.map(f => {
                const isSel = selected.includes(f.filename);
                return (
                  <button
                    key={f.file_path || f.filename}
                    type="button"
                    onClick={() => onToggle(f.filename)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                      isSel ? "bg-[#ececee] border border-[#ff6a00]/20" : "hover:bg-panel-2 border border-transparent"
                    )}
                  >
                    <span className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      isSel ? "bg-ai border-ai" : "bg-panel border-line"
                    )}>
                      {isSel && <CheckCircle size={12} className="text-white" />}
                    </span>
                    <FileText size={14} className="text-muted shrink-0" />
                    <span className="text-sm text-text truncate">{f.filename}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OfferDocsModal({ selectedCvs, selectedAbes, onToggleCv, onToggleAbe, onClose, onConfirm }: {
  selectedCvs: string[];
  selectedAbes: string[];
  onToggleCv: (f: string) => void;
  onToggleAbe: (f: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const total = selectedCvs.length + selectedAbes.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-panel rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-text">Documents à intégrer à l&apos;offre</h2>
            <p className="text-xs text-muted mt-0.5 max-w-md">
              Sélectionnez les CV et les attestations de bonne exécution (ABE) à inclure, ou téléversez-en de nouveaux.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-panel-2 text-muted shrink-0" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <DocPicker
            label="CV des intervenants"
            icon={<Users size={15} />}
            folder="cvs"
            accentClass="bg-ai text-white"
            selected={selectedCvs}
            onToggle={onToggleCv}
          />
          <DocPicker
            label="ABE — Attestations de bonne exécution"
            icon={<FileCheck size={15} />}
            folder="abe"
            accentClass="bg-warn text-white"
            selected={selectedAbes}
            onToggle={onToggleAbe}
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-line">
          <span className="text-xs text-muted max-w-[45%]">
            {total === 0
              ? "Aucune sélection — l'offre utilisera le matching automatique des CV."
              : `${total} document${total > 1 ? "s" : ""} sélectionné${total > 1 ? "s" : ""}.`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text bg-panel border border-line rounded-lg hover:bg-panel-2"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="flex items-center gap-2 px-5 py-2 bg-ai hover:brightness-95 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Sparkles size={15} /> Générer l&apos;offre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 5 — Offre technique ──────────────────────────────────────────────────

function Step5({ ao, onValidate, triggerDownload, onOfferReady }: {
  ao: AOEntry;
  onValidate: () => void;
  triggerDownload: (blob: Blob, filename: string) => void;
  onOfferReady: (filename: string) => void;
}) {
  const [, setSections] = useState<OfferSections | null>(null);
  const [filename, setFilename] = useState("");
  const [building, setBuilding] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);

  // Documents choisis dans le modal — injectés dans le .docx (CV → équipe, ABE → références).
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedCvs, setSelectedCvs] = useState<string[]>([]);
  const [selectedAbes, setSelectedAbes] = useState<string[]>([]);
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (f: string) =>
    setter(prev => (prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]));

  // Génération JAMAIS bloquante, en une seule action : sections IA (étape 1) PUIS
  // rendu du .docx (étape 2) PUIS téléchargement automatique. Les éléments que le
  // modèle ne permet pas de remplir sont marqués « À COMPLÉTER » dans le document
  // (bannière en page de garde + annexe de fin reprenant le contenu généré).
  const generateOffer = async () => {
    if (!ao.scoringResult) return;
    setBuilding(true);
    setGenError(null);
    try {
      const res = await buildOfferSections(ao.scoringResult, ao.clientName || undefined);
      setSections(res.sections);
      setFilename(res.filename);
      const name = res.filename || "Offre-Technique.docx";
      const blob = await renderOffer(
        ao.scoringResult, res.sections, ao.clientName || undefined, selectedCvs, selectedAbes,
      );
      setLastBlob(blob);
      triggerDownload(blob, name);
      onOfferReady(name);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Échec de la génération de l'offre");
    } finally {
      setBuilding(false);
    }
  };
  // Le bouton « Générer » ouvre d'abord le modal de sélection des CV / ABE.
  const requestGenerate = () => { setShowDocsModal(true); };
  const confirmGenerate = () => { setShowDocsModal(false); generateOffer(); };

  // Re-téléchargement du dernier .docx produit. Sans blob en mémoire (ex. après
  // rechargement de page), on repasse par le modal pour ne pas régénérer sans CV/ABE.
  const redownload = () => {
    if (lastBlob) triggerDownload(lastBlob, filename || "Offre-Technique.docx");
    else requestGenerate();
  };

  if (building) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div className="w-16 h-16 rounded-xl bg-[#ececee] flex items-center justify-center">
          <Sparkles size={32} className="text-ai animate-pulse" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-text">Génération des sections de l'offre...</p>
          <p className="text-sm text-muted mt-1.5">Notre IA rédige les sections à partir de votre AO et de votre GED</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-line animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showDocsModal && (
        <OfferDocsModal
          selectedCvs={selectedCvs}
          selectedAbes={selectedAbes}
          onToggleCv={toggle(setSelectedCvs)}
          onToggleAbe={toggle(setSelectedAbes)}
          onClose={() => setShowDocsModal(false)}
          onConfirm={confirmGenerate}
        />
      )}
      <SectionCard title="Génération de l'offre technique" icon={<FileText size={15} />}>
        <p className="text-sm text-muted leading-relaxed mb-3">
          L'offre technique est générée automatiquement par IA à partir de votre AO et de vos références GED.
          Elle inclut : <span className="text-text font-medium">Compréhension du besoin · Approche méthodologique · Présentation équipe · Références similaires · Planning · Conditions commerciales.</span>
        </p>
        {ao.scoringResult && (
          <div className="flex items-center gap-2 mb-4">
            <RecoBadge rec={ao.scoringResult.recommendation} />
            <span className="text-xs text-muted">Décision : {ao.decision === "go" ? "GO ✓" : "CONDITIONNEL ⚡"}</span>
          </div>
        )}

        {!ao.offerGenerated ? (
          <div className="flex flex-col items-center gap-4 py-8 border border-dashed border-line rounded-xl">
            <FileText size={36} className="text-line" />
            <div className="text-center">
              <p className="text-sm font-medium text-text">L'offre n'a pas encore été générée</p>
              <p className="text-xs text-muted mt-1">Durée estimée : 20-30 secondes</p>
            </div>
            <button
              onClick={requestGenerate}
              className="flex items-center gap-2 px-5 py-2.5 bg-ai hover:brightness-95 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Sparkles size={15} />
              Générer l'offre technique
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 bg-good/10 border border-good/35 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-good/15 flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-good" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">Offre générée avec succès</p>
              <p className="text-xs text-muted truncate mt-0.5">{ao.offerFilename}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={requestGenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-panel hover:bg-panel-2 border border-line rounded-lg text-xs font-medium text-ai transition-colors"
              >
                <Sparkles size={12} /> Choisir CV/ABE & régénérer
              </button>
              <button
                onClick={redownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-panel hover:bg-panel-2 border border-line rounded-lg text-xs font-medium text-text transition-colors"
              >
                <Download size={12} /> Télécharger
              </button>
            </div>
          </div>
        )}

        {genError && (
          <div className="flex items-start gap-2 mt-3 p-3 bg-bad/10 border border-bad/35 rounded-lg text-xs text-bad">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{genError}</span>
          </div>
        )}
      </SectionCard>

      <div className="flex items-center justify-between pt-1">
        {ao.offerGenerated && !ao.offerValidated ? (
          <button
            onClick={onValidate}
            className="ml-auto flex items-center gap-2 px-5 py-2 bg-good hover:bg-good text-white rounded-xl text-sm font-medium transition-colors"
          >
            <CheckCircle size={14} />
            Valider l'offre → Étape 6
            <ArrowRight size={14} />
          </button>
        ) : ao.offerValidated ? (
          <div className="ml-auto flex items-center gap-2 text-good text-sm font-medium bg-good/10 rounded-xl px-4 py-2.5 border border-good/25">
            <CheckCircle size={16} /> Offre validée
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Conformité : checklist validée par l'IA + contrôle humain par cochage ────────

const _STATUT_LABEL: Record<string, string> = {
  CONFORME: "Conforme", CONFORME_PARTIEL: "Partiel", NON_CONFORME: "Non conforme",
  NON_APPLICABLE: "N/A", A_TRAITER: "À évaluer",
};
const _STATUT_STYLE: Record<string, string> = {
  CONFORME: "bg-good/10 text-good border-good/35",
  CONFORME_PARTIEL: "bg-warn/10 text-warn border-warn/35",
  NON_CONFORME: "bg-bad/10 text-bad border-bad/35",
  NON_APPLICABLE: "bg-panel-2 text-muted border-line",
  A_TRAITER: "bg-panel-2 text-muted border-line",
};
const _STATUT_OPTIONS = ["CONFORME", "CONFORME_PARTIEL", "NON_CONFORME", "NON_APPLICABLE"];

function ConformityPanel({ ao }: { ao: AOEntry }) {
  const [items, setItems] = useState<ConformityExigence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [statuts, setStatuts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const aoName = ao.scoringResult?.ao_filename ?? ao.filename;

  async function runAssess() {
    if (!ao.scoringResult) return;
    setLoading(true); setError(""); setSavedMsg("");
    try {
      const m = await assessMatrix(ao.scoringResult, ao.clientName);
      setItems(m.exigences);
      const conf = new Set<string>();
      const st: Record<string, string> = {};
      for (const ex of m.exigences) {
        if (ex.confirme) conf.add(ex.id);
        st[ex.id] = ex.confirme && ex.statut_conformite !== "A_TRAITER" ? ex.statut_conformite : ex.statut_suggere;
      }
      setConfirmed(conf); setStatuts(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'analyse de conformité.");
    } finally {
      setLoading(false);
    }
  }

  function toggleConfirm(id: string) {
    setConfirmed(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  function setStatut(id: string, v: string) { setStatuts(prev => ({ ...prev, [id]: v })); }

  async function saveConfirmations() {
    if (!items) return;
    setSaving(true); setError(""); setSavedMsg("");
    try {
      const confirmations = items.map(ex => ({
        id: ex.id,
        confirme: confirmed.has(ex.id),
        statut_confirme: confirmed.has(ex.id) ? (statuts[ex.id] ?? ex.statut_suggere) : undefined,
      }));
      const res = await confirmMatrix(aoName, confirmations);
      setItems(res.exigences);
      setSavedMsg(`${res.confirmes}/${res.total} exigence(s) confirmée(s) et enregistrée(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement des confirmations.");
    } finally {
      setSaving(false);
    }
  }

  if (!ao.scoringResult) return null;

  const total = items?.length ?? 0;
  const nbConfirmed = items ? items.filter(ex => confirmed.has(ex.id)).length : 0;

  return (
    <SectionCard title="Conformité — validée par l'IA, confirmée par cochage" icon={<FileCheck size={15} />}>
      {!items ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            L'IA pré-statue chaque exigence de l'AO (conforme / partiel / non conforme) à partir de
            l'analyse du scoring. Vous confirmez ensuite, par cochage, que chaque élément validé est
            effectivement réuni.
          </p>
          <button
            onClick={runAssess}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-ai hover:brightness-110 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Analyser la conformité (IA)
          </button>
          {error && <p className="text-xs text-bad">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text">{nbConfirmed}/{total} confirmée(s)</span>
            <button onClick={runAssess} disabled={loading} className="text-xs text-muted hover:text-ai">
              {loading ? "…" : "Recalculer"}
            </button>
          </div>
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1">
            {items.map(ex => (
              <div key={ex.id} className="border border-line rounded-lg p-2.5">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={confirmed.has(ex.id)}
                    onChange={() => toggleConfirm(ex.id)}
                    className="mt-0.5 w-4 h-4 rounded border-line text-ai cursor-pointer shrink-0 accent-[#ff6a00]"
                    title="Confirmer que cette exigence est réunie"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", _STATUT_STYLE[ex.statut_suggere] ?? _STATUT_STYLE.A_TRAITER)}>
                        IA : {_STATUT_LABEL[ex.statut_suggere] ?? ex.statut_suggere}
                      </span>
                      {ex.blocking && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-bad/10 text-bad border-bad/35">éliminatoire</span>
                      )}
                      {ex.confiance_ia > 0 && (
                        <span className="text-[10px] text-muted">conf. {Math.round(ex.confiance_ia * 100)}%</span>
                      )}
                    </div>
                    <p className="text-xs text-text mt-1 leading-relaxed">{ex.texte}</p>
                    {ex.justification_ia && (
                      <p className="text-[11px] text-muted italic mt-0.5">{ex.justification_ia}</p>
                    )}
                  </div>
                  {confirmed.has(ex.id) && (
                    <select
                      value={statuts[ex.id] ?? ex.statut_suggere}
                      onChange={e => setStatut(ex.id, e.target.value)}
                      className="text-[11px] border border-line rounded-lg px-1.5 py-1 bg-panel shrink-0"
                    >
                      {_STATUT_OPTIONS.map(s => <option key={s} value={s}>{_STATUT_LABEL[s]}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            {savedMsg
              ? <span className="text-xs text-good font-medium">{savedMsg}</span>
              : <span className="text-xs text-muted">Cochez les exigences réunies, ajustez le statut, puis enregistrez.</span>}
            <button
              onClick={saveConfirmations}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-ai hover:brightness-95 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Enregistrer les confirmations
            </button>
          </div>
          {error && <p className="text-xs text-bad">{error}</p>}
        </div>
      )}
    </SectionCard>
  );
}

// ── Step 6 — Checklist dossier ────────────────────────────────────────────────

function Step6({ ao, onToggle, onNoteChange, onAddItem, onDeleteItem, onExport, exporting, onValidate }: {
  ao: AOEntry;
  onToggle: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
  onAddItem: (category: "Technique" | "Administratif" | "Commercial") => void;
  onDeleteItem: (id: string) => void;
  onExport: () => void;
  exporting: boolean;
  onValidate: () => void;
}) {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const toggleNote = (id: string) => setExpandedNotes(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const catConfig: { key: "Technique" | "Administratif" | "Commercial"; color: string; border: string; icon: React.ReactNode }[] = [
    { key: "Technique", color: "text-ai", border: "border-[#deded7]", icon: <FileText size={14} className="text-muted" /> },
    { key: "Administratif", color: "text-text", border: "border-line", icon: <Shield size={14} className="text-muted" /> },
    { key: "Commercial", color: "text-warn", border: "border-warn/25", icon: <Target size={14} className="text-warn" /> },
  ];

  const requiredItems = ao.checklist.filter(it => it.required);
  const checkedRequired = requiredItems.filter(it => it.checked);
  const allRequiredDone = requiredItems.length > 0 && checkedRequired.length === requiredItems.length;

  return (
    <div className="space-y-4">
      {/* Conformité validée par l'IA + cochage humain (contrôle de complétude) */}
      <ConformityPanel ao={ao} />
      {/* Progress */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-text">Complétude du dossier</span>
          <span className={cn("text-sm font-bold", allRequiredDone ? "text-good" : "text-muted")}>
            {checkedRequired.length}/{requiredItems.length} obligatoires
          </span>
        </div>
        <div className="w-full h-2 bg-panel-2 rounded-full overflow-hidden">
          <div
            className={cn("h-2 rounded-full transition-all", allRequiredDone ? "bg-good" : "bg-ai")}
            style={{ width: `${requiredItems.length > 0 ? (checkedRequired.length / requiredItems.length) * 100 : 0}%` }}
          />
        </div>
        <p className="text-xs text-muted mt-1.5">
          {ao.checklist.filter(it => it.checked).length}/{ao.checklist.length} items totaux cochés
        </p>
      </div>

      {catConfig.map(({ key, color, icon }) => {
        const items = ao.checklist.filter(it => it.category === key);
        return (
          <SectionCard key={key} title={key} icon={icon}>
            <div className="space-y-1.5">
              {items.map(item => (
                <div key={item.id} className="rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2.5 p-2.5">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => onToggle(item.id)}
                      className="w-4 h-4 rounded border-line text-ai cursor-pointer shrink-0 accent-[#ff6a00]"
                    />
                    <span className={cn(
                      "flex-1 text-xs leading-relaxed",
                      item.checked ? "line-through text-muted" : "text-text",
                      item.required ? "font-medium" : ""
                    )}>
                      {item.label}
                    </span>
                    {item.required && (
                      <Lock size={10} className="shrink-0 text-line" />
                    )}
                    <button
                      onClick={() => toggleNote(item.id)}
                      className="shrink-0 p-0.5 text-line hover:text-ai transition-colors"
                      title="Ajouter une note"
                    >
                      <Eye size={12} />
                    </button>
                    {!item.required && (
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="shrink-0 p-0.5 text-line hover:text-bad transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  {expandedNotes.has(item.id) && (
                    <div className="px-2.5 pb-2.5">
                      <input
                        type="text"
                        value={item.note}
                        onChange={e => onNoteChange(item.id, e.target.value)}
                        placeholder="Observation, référence, commentaire..."
                        className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 bg-panel-2 focus:outline-none focus:ring-1 focus:ring-[#ff6a00]/25 placeholder:text-line"
                      />
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => onAddItem(key)}
                className={cn("flex items-center gap-1.5 text-xs mt-1 py-1 px-1", color, "hover:opacity-70 transition-opacity")}
              >
                <Plus size={12} /> Ajouter un élément
              </button>
            </div>
          </SectionCard>
        );
      })}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-panel-2 text-text rounded-xl text-sm font-medium border border-line hover:border-line disabled:opacity-50 transition-colors"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exporter la checklist
        </button>
        {!ao.checklistValidated ? (
          <button
            onClick={onValidate}
            disabled={!allRequiredDone}
            className="flex items-center gap-2 px-5 py-2 bg-ai hover:brightness-95 text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors"
          >
            <CheckCircle size={14} />
            Valider le dossier → Étape 7
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-good text-sm font-medium bg-good/10 rounded-xl px-4 py-2.5 border border-good/25">
            <CheckCircle size={16} /> Dossier validé
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 7 — Soumission ───────────────────────────────────────────────────────

function Step7({ ao, onUpdate, onValidate }: {
  ao: AOEntry;
  onUpdate: (patch: Partial<AOEntry>) => void;
  onValidate: () => void;
}) {
  const dateRemise = ao.scoringResult?.date_remise ?? "";
  const lateWarning = ao.submissionDate && dateRemise &&
    new Date(ao.submissionDate) > new Date(dateRemise);

  const canSubmit = ao.submissionDate.trim() !== "" && ao.submissionChannel.trim() !== "";

  if (ao.submissionValidated) {
    return (
      <div className="space-y-4">
        {/* Confirmation soumission */}
        <SectionCard title="Dossier soumis" icon={<Send size={15} />} className="border-good/35 bg-good/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-good/15 flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-good" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-text">AO soumis avec succès</p>
              <p className="text-sm text-muted">
                <span className="font-medium">Date :</span> {ao.submissionDate ? new Date(ao.submissionDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
              </p>
              <p className="text-sm text-muted">
                <span className="font-medium">Canal :</span> {ao.submissionChannel}
              </p>
              {ao.submissionNote && (
                <p className="text-sm text-muted italic mt-1">"{ao.submissionNote}"</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Résultat de l'AO */}
        <SectionCard title="Résultat de l'AO" icon={<Trophy size={15} />} className="border-line bg-panel-2/20">
          {ao.result && ao.result !== "pending" ? (
            <div className={cn(
              "flex items-start gap-4 p-3 rounded-xl",
              ao.result === "won" ? "bg-good/10 border border-good/35" : "bg-bad/10 border border-bad/35"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                ao.result === "won" ? "bg-good/15" : "bg-bad/15"
              )}>
                {ao.result === "won"
                  ? <Trophy size={20} className="text-good" />
                  : <ThumbsDown size={20} className="text-bad" />}
              </div>
              <div className="space-y-1">
                <p className={cn("font-bold text-sm", ao.result === "won" ? "text-good" : "text-bad")}>
                  {ao.result === "won" ? "🏆 AO Gagné !" : "AO Perdu"}
                </p>
                {ao.resultDate && <p className="text-xs text-muted">Le {new Date(ao.resultDate).toLocaleDateString("fr-FR")}</p>}
                {ao.competitor && <p className="text-xs text-muted">Concurrent gagnant : <span className="font-medium">{ao.competitor}</span></p>}
                {ao.resultNote && <p className="text-xs text-muted italic mt-1">"{ao.resultNote}"</p>}
              </div>
              <button
                onClick={() => onUpdate({ result: null, competitor: "", resultNote: "", resultDate: "" })}
                className="ml-auto text-xs text-muted hover:text-text shrink-0"
              >
                Modifier
              </button>
            </div>
          ) : ao.result === "pending" ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-warn/10 border border-warn/35">
              <Clock size={16} className="text-warn shrink-0" />
              <p className="text-sm font-medium text-warn flex-1">Résultat en attente...</p>
              <button
                onClick={() => onUpdate({ result: null })}
                className="text-xs text-muted hover:text-text"
              >
                Modifier
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted">Avez-vous reçu le résultat de cet appel d'offres ?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdate({ result: "won", resultDate: new Date().toISOString().split("T")[0] })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-good hover:bg-good text-white transition-colors"
                >
                  <Trophy size={14} /> Gagné 🏆
                </button>
                <button
                  onClick={() => onUpdate({ result: "lost", resultDate: new Date().toISOString().split("T")[0] })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-bad hover:bg-bad text-white transition-colors"
                >
                  <ThumbsDown size={14} /> Perdu
                </button>
                <button
                  onClick={() => onUpdate({ result: "pending" })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-warn/15 hover:bg-warn/25 text-warn transition-colors"
                >
                  <Clock size={14} /> En attente
                </button>
              </div>
              {ao.result === "lost" && (
                <div className="space-y-2 pt-1">
                  <input
                    placeholder="Concurrent gagnant (optionnel)"
                    value={ao.competitor}
                    onChange={e => onUpdate({ competitor: e.target.value })}
                    className="w-full text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-bad/25 bg-panel"
                  />
                  <textarea
                    placeholder="Raison / retour client (optionnel)"
                    value={ao.resultNote}
                    onChange={e => onUpdate({ resultNote: e.target.value })}
                    rows={2}
                    className="w-full text-sm border border-line rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-bad/25 bg-panel placeholder:text-line"
                  />
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Informations de soumission" icon={<CalendarDays size={15} />} className="border-[#deded7] bg-[#ececee]/20">
        <div className="space-y-4">
          {dateRemise && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Date limite AO :</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold border border-teal-200">
                <CalendarDays size={11} />
                {dateRemise}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              Date de soumission effective <span className="text-bad">*</span>
            </label>
            <input
              type="date"
              value={ao.submissionDate}
              onChange={e => onUpdate({ submissionDate: e.target.value })}
              className="w-full sm:w-60 text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/25 bg-panel"
            />
            {lateWarning && (
              <p className="flex items-center gap-1.5 text-xs text-warn mt-1.5">
                <AlertTriangle size={12} /> Date après la limite de remise de l'AO
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              Canal de dépôt <span className="text-bad">*</span>
            </label>
            <select
              value={ao.submissionChannel}
              onChange={e => onUpdate({ submissionChannel: e.target.value })}
              className="w-full sm:w-72 text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/25 bg-panel"
            >
              <option value="">Sélectionner un canal...</option>
              <option value="Email">Email</option>
              <option value="Plateforme en ligne">Plateforme en ligne</option>
              <option value="Dépôt physique">Dépôt physique</option>
              <option value="Courrier recommandé">Courrier recommandé</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1.5">Note de suivi (optionnel)</label>
            <textarea
              value={ao.submissionNote}
              onChange={e => onUpdate({ submissionNote: e.target.value })}
              placeholder="Interlocuteur, accusé de réception, numéro de dépôt..."
              rows={3}
              className="w-full text-sm border border-line rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/25 bg-panel placeholder:text-line"
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          onClick={onValidate}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-6 py-2.5 bg-good hover:bg-good text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors"
        >
          <Send size={14} />
          Confirmer la soumission
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function getKanbanColumn(ao: AOEntry): "analyse" | "redaction" | "soumis" | "gagne" | "perdu" {
  if (ao.result === "won") return "gagne";
  if (ao.result === "lost") return "perdu";
  if (ao.submissionValidated) return "soumis";
  if (ao.responsePlanValidated) return "redaction";
  return "analyse";
}

const KANBAN_COLS = [
  { key: "analyse",   label: "En analyse",   color: "bg-ai",   light: "bg-[#ececee] border-[#deded7]",   text: "text-ai" },
  { key: "redaction", label: "En rédaction",  color: "bg-muted", light: "bg-panel-2 border-line", text: "text-text" },
  { key: "soumis",    label: "Soumis",        color: "bg-teal-500",   light: "bg-teal-50 border-teal-200",   text: "text-teal-700" },
  { key: "gagne",     label: "Gagnés 🏆",    color: "bg-good",  light: "bg-good/10 border-good/35", text: "text-good" },
  { key: "perdu",     label: "Perdus",        color: "bg-bad/60",    light: "bg-bad/10 border-bad/35",     text: "text-bad" },
] as const;

export function PresalesWorkflow({ currentUserName = "" }: { currentUserName?: string }) {
  const [aos, setAos] = useState<AOEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewStep, setViewStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [pageView, setPageView] = useState<"home" | "workflow" | "kanban">("home");
  const [homeFilter, setHomeFilter] = useState<"all" | 1 | 2 | 3 | 4 | 5 | 6 | 7>("all");
  const [homePage, setHomePage] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [downloadingOriginalId, setDownloadingOriginalId] = useState<string | null>(null);
  const [homeDownloadError, setHomeDownloadError] = useState<string | null>(null);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [validatingDecision, setValidatingDecision] = useState(false);
  const [exportingAnalysis, setExportingAnalysis] = useState(false);
  const [exportingMatrix, setExportingMatrix] = useState(false);
  const [exportingScoring, setExportingScoring] = useState(false);
  const [exportingStrategy, setExportingStrategy] = useState(false);
  const [exportingChecklist, setExportingChecklist] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoLoaded = useRef(false);
  const [loadingDossiers, setLoadingDossiers] = useState(true);
  // Sync backend débouncée : chaque updateAO() accumule son patch ici et le flush
  // (PATCH réseau) 500ms après la dernière modification sur ce dossier — évite une
  // requête par frappe clavier tout en garantissant qu'aucun champ modifié n'est
  // perdu (fusion des patches successifs, pas juste le dernier).
  const pendingPatchRef = useRef<Map<string, Partial<AOEntry>>>(new Map());
  const patchTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const selectedAO = aos.find(a => a.id === selectedId) ?? null;

  // Le backend est la seule source de vérité (fichier + état persistés en base) —
  // condition pour que « refaire une étape » fonctionne après un rechargement de page.
  useEffect(() => {
    let cancelled = false;
    listDossiers()
      .then(rows => { if (!cancelled) setAos(rows as unknown as AOEntry[]); })
      .catch(e => { if (!cancelled) console.error("Chargement des dossiers présale échoué:", e); })
      .finally(() => { if (!cancelled) setLoadingDossiers(false); });
    return () => { cancelled = true; };
  }, []);

  function updateAO(id: string, patch: Partial<AOEntry>) {
    setAos(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

    const accumulated = { ...(pendingPatchRef.current.get(id) ?? {}), ...patch };
    pendingPatchRef.current.set(id, accumulated);
    const existingTimer = patchTimerRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);
    patchTimerRef.current.set(id, setTimeout(() => {
      patchTimerRef.current.delete(id);
      const toSend = pendingPatchRef.current.get(id);
      pendingPatchRef.current.delete(id);
      if (toSend) {
        patchDossier(id, toSend as Record<string, unknown>).catch(e => {
          console.error("Synchronisation du dossier échouée:", e);
        });
      }
    }, 500));
  }

  async function handleFiles(
    files: FileList | File[],
    meta?: { clientName?: string; deadline?: string },
  ) {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) continue;
      const id = genId();
      const entry = newEntry(id, file.name);
      if (meta?.clientName) entry.clientName = meta.clientName;
      entry.owner = currentUserName;
      if (meta?.deadline) entry.deadline = meta.deadline;
      setAos(prev => [entry, ...prev]);
      setSelectedId(id);
      setViewStep(1);
      try {
        await createDossier(id, file, entry as unknown as Record<string, unknown>);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setAos(prev => prev.map(a => a.id === id
          ? { ...a, status: "error", errorMessage: `Échec de l'enregistrement du dossier : ${msg}` }
          : a));
      }
    }
  }

  // force=true : relance une analyse fraîche (ignore le cache disque backend) —
  // utilisé par le bouton « Refaire l'analyse ». Le fichier est lu depuis le disque
  // serveur (dossier persisté), donc rejouable à tout moment, même après reload.
  async function startAnalysis(id: string, force = false) {
    setAos(prev => prev.map(a => a.id === id ? { ...a, status: "scoring", errorMessage: undefined } : a));
    try {
      const result = await analyzeDossier(id, force);
      setAos(prev => prev.map(a => a.id === id ? { ...a, status: "scored", scoringResult: result } : a));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAos(prev => prev.map(a => a.id === id ? { ...a, status: "error", errorMessage: msg } : a));
    }
  }


  function selectAO(id: string) {
    setSelectedId(id);
    const ao = aos.find(a => a.id === id);
    if (ao?.scoringResult) {
      setViewStep(getActiveStep(ao));
    } else {
      setViewStep(1);
    }
  }

  function removeAO(id: string) {
    const timer = patchTimerRef.current.get(id);
    if (timer) clearTimeout(timer);
    patchTimerRef.current.delete(id);
    pendingPatchRef.current.delete(id);
    setAos(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    // 404 toléré côté deleteDossier() : couvre aussi le dossier démo (jamais persisté).
    deleteDossier(id).catch(e => console.error("Suppression du dossier échouée:", e));
  }

  function openDossier(id: string) {
    selectAO(id);
    setPageView("workflow");
  }

  // Dossier de démonstration — local uniquement (pas de fichier réel à persister
  // côté backend), disparaît donc au rechargement de page. C'est intentionnel.
  function loadDemo() {
    if (demoLoaded.current) return;
    demoLoaded.current = true;
    const id = genId();
    const entry: AOEntry = {
      ...newEntry(id, MOCK_RESULT.ao_filename),
      status: "scored",
      scoringResult: MOCK_RESULT,
      clientName: "BSIC",
    };
    setAos(prev => [entry, ...prev]);
    setSelectedId(id);
    setViewStep(1);
  }

  async function handleValidateDecision(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao) return;
    setValidatingDecision(true);
    updateAO(aoId, { decisionValidated: true });

    if (ao.decision === "no_bid") {
      setViewStep(2);
      setValidatingDecision(false);
      return;
    }

    setViewStep(3);
    setGeneratingStrategy(true);
    try {
      const strategy = await generateBidStrategy(
        ao.scoringResult!,
        ao.decision === "go" ? "GO" : "CONDITIONAL",
        ao.clientName,
        ao.decisionReason,
      );
      updateAO(aoId, {
        bidStrategy: strategy,
        strategyText: strategy.strategy_text,
        responsePlan: strategy.response_plan,
      });
    } catch (e) {
      console.error("Strategy generation failed:", e);
    } finally {
      setGeneratingStrategy(false);
      setValidatingDecision(false);
    }
  }

  // Refaire la génération de la stratégie (étape 3) sans repasser par la décision.
  async function regenerateStrategy(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult || !ao.decision || ao.decision === "no_bid") return;
    setGeneratingStrategy(true);
    try {
      const strategy = await generateBidStrategy(
        ao.scoringResult,
        ao.decision === "go" ? "GO" : "CONDITIONAL",
        ao.clientName,
        ao.decisionReason,
      );
      updateAO(aoId, {
        bidStrategy: strategy,
        strategyText: strategy.strategy_text,
        responsePlan: strategy.response_plan,
      });
    } catch (e) {
      console.error("Strategy regeneration failed:", e);
    } finally {
      setGeneratingStrategy(false);
    }
  }



  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Délai avant nettoyage pour laisser le navigateur démarrer le téléchargement
    window.setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }

  async function handleDownloadOriginal(ao: AOEntry) {
    setDownloadingOriginalId(ao.id);
    setHomeDownloadError(null);
    try {
      const blob = await downloadDossierFile(ao.id);
      triggerDownload(blob, ao.filename);
    } catch (e) {
      setHomeDownloadError(e instanceof Error ? e.message : "Téléchargement du fichier impossible.");
    } finally {
      setDownloadingOriginalId(null);
    }
  }

  async function handleExportAnalysis(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult) {
      console.warn("handleExportAnalysis: scoringResult manquant pour", aoId);
      return;
    }
    setExportError(null);
    setExportingAnalysis(true);
    try {
      console.log("Export analyse → requête backend...");
      const blob = await exportAnalysis(ao.scoringResult, ao.clientName || undefined);
      console.log("Export analyse → blob reçu", blob.size, "octets, type:", blob.type);
      triggerDownload(blob, `Analyse-AO_${ao.filename.replace(/\.(pdf|docx)$/i, "")}.docx`);
      setExportSuccess("Téléchargement lancé — vérifiez votre dossier Téléchargements.");
      window.setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Export analyse échoué:", e);
      setExportError(msg);
    } finally {
      setExportingAnalysis(false);
    }
  }

  async function handleExportMatrix(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult) {
      console.warn("handleExportMatrix: scoringResult manquant pour", aoId);
      return;
    }
    setExportError(null);
    setExportingMatrix(true);
    try {
      const blob = await exportMatrix(ao.scoringResult, ao.clientName || undefined);
      triggerDownload(blob, `Matrice-Conformite_${ao.filename.replace(/\.(pdf|docx)$/i, "")}.xlsx`);
      setExportSuccess("Téléchargement lancé — vérifiez votre dossier Téléchargements.");
      window.setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportingMatrix(false);
    }
  }

  async function handleExportScoring(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult) return;
    setExportError(null);
    setExportingScoring(true);
    try {
      const blob = await exportScoring(ao.scoringResult, ao.clientName || undefined);
      triggerDownload(blob, `Scoring-AO_${ao.filename.replace(/\.(pdf|docx)$/i, "")}.docx`);
      setExportSuccess("Téléchargement lancé — vérifiez votre dossier Téléchargements.");
      window.setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportingScoring(false);
    }
  }

  async function handleExportStrategy(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult) {
      console.warn("handleExportStrategy: scoringResult manquant pour", aoId);
      return;
    }
    if (!ao.bidStrategy) {
      console.warn("handleExportStrategy: bidStrategy manquant pour", aoId);
      return;
    }
    setExportError(null);
    setExportingStrategy(true);
    try {
      const blob = await exportStrategy(
        ao.scoringResult,
        ao.bidStrategy,
        ao.clientName || undefined,
        ao.decision === "go" ? "GO" : ao.decision === "conditional" ? "CONDITIONAL" : "NO_BID",
      );
      triggerDownload(blob, `Strategie-Reponse_${ao.filename.replace(/\.(pdf|docx)$/i, "")}.docx`);
      setExportSuccess("Téléchargement lancé — vérifiez votre dossier Téléchargements.");
      window.setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Export stratégie échoué:", e);
      setExportError(msg);
    } finally {
      setExportingStrategy(false);
    }
  }

  async function handleExportChecklist(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult) return;
    setExportError(null);
    setExportingChecklist(true);
    try {
      // Pièces réelles de l'AO (statut éventuellement édité côté stratégie) ;
      // si vide, le backend retombe sur une checklist générique inférée.
      const appendices = ao.bidStrategy?.appendices ?? ao.scoringResult.appendices ?? [];
      const blob = await exportChecklist(
        ao.scoringResult.ao_filename,
        appendices,
        ao.clientName || undefined,
        ao.submissionDate || undefined,
      );
      triggerDownload(blob, `Checklist_${ao.filename.replace(/\.(pdf|docx)$/i, "")}.docx`);
      setExportSuccess("Checklist exportée — téléchargement lancé.");
      window.setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(msg);
    } finally {
      setExportingChecklist(false);
    }
  }

  // ── Stats rapides pour le header ─────────────────────────────────────────────
  const statsAos = {
    total: aos.length,
    won: aos.filter(a => a.result === "won").length,
    lost: aos.filter(a => a.result === "lost").length,
    submitted: aos.filter(a => a.submissionValidated && !a.result).length,
    inProgress: aos.filter(a => !a.submissionValidated && a.status === "scored").length,
  };

  // ── Vue d'accueil : upload en haut + historique filtrable en bas ───────────────
  if (pageView === "home") {
    const stepCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    aos.forEach(a => { if (a.status === "scored") stepCounts[getActiveStep(a)]++; });
    const filteredAos = homeFilter === "all"
      ? aos
      : aos.filter(a => a.status === "scored" && getActiveStep(a) === homeFilter);
    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(filteredAos.length / PAGE_SIZE));
    const page = Math.min(homePage, totalPages);
    const pagedAos = filteredAos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const validCount = aos.filter(
      a => a.status === "scored" && !a.submissionValidated && a.decision !== "no_bid" && !a.result
    ).length;

    return (
      <div className="flex flex-col h-full overflow-hidden bg-ink">
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* En-tête module (style charte) */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
                ● exécution commerciale
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.01em] text-text">Appel d'offres</h1>
              <div className="mt-1 text-[13px] text-muted">
                Analyse d&apos;appels d&apos;offres, scoring IA &amp; génération d&apos;offres
                {statsAos.total > 0 && (
                  <>
                    {" — "}{statsAos.total} dossier{statsAos.total > 1 ? "s" : ""} · {validCount} en cours · {statsAos.won} gagné{statsAos.won > 1 ? "s" : ""} · {statsAos.lost} perdu{statsAos.lost > 1 ? "s" : ""}
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs px-4 py-2 bg-ai hover:brightness-95 text-white rounded-lg font-medium transition"
            >
              <Plus size={14} /> Ajouter appel d&apos;offre
            </button>
          </div>

          {/* Historique */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-text">Historique des dossiers</h2>
              {aos.length === 0 && (
                <button
                  onClick={loadDemo}
                  className="text-xs text-ai py-1.5 px-3 border border-[#deded7] rounded-lg hover:bg-[#ececee] transition font-medium"
                >
                  ✨ Charger un AO démo
                </button>
              )}
            </div>

            {homeDownloadError && (
              <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-bad/10 border border-bad/35 rounded-xl text-sm text-bad">
                <XCircle size={15} className="shrink-0 text-bad" />
                <span className="flex-1">{homeDownloadError}</span>
                <button onClick={() => setHomeDownloadError(null)} className="text-bad hover:text-bad text-xs shrink-0">✕</button>
              </div>
            )}

            {/* Filtre par étape */}
            {aos.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <FilterChip
                  active={homeFilter === "all"}
                  onClick={() => { setHomeFilter("all"); setHomePage(1); }}
                  label="Tous"
                  count={aos.length}
                />
                {([1, 2, 3, 4, 5, 6, 7] as const)
                  .filter(s => stepCounts[s] > 0)
                  .map(s => (
                    <FilterChip
                      key={s}
                      active={homeFilter === s}
                      onClick={() => { setHomeFilter(s); setHomePage(1); }}
                      label={`${s}· ${STEP_LABELS[s]}`}
                      count={stepCounts[s]}
                    />
                  ))}
              </div>
            )}

            {/* Tableau */}
            <div className="rounded-2xl border border-line bg-panel overflow-hidden">
              {loadingDossiers ? (
                <div className="py-16 text-center">
                  <Loader2 size={24} className="animate-spin text-muted mx-auto mb-3" />
                  <p className="text-sm text-muted">Chargement des dossiers…</p>
                </div>
              ) : aos.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText size={30} className="text-line mx-auto mb-3" />
                  <p className="text-sm font-semibold text-muted">Aucun dossier pour l&apos;instant</p>
                  <p className="text-xs text-muted mt-1">
                    Cliquez sur « Ajouter appel d&apos;offre » pour lancer une analyse.
                  </p>
                </div>
              ) : filteredAos.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted">
                  Aucun dossier à cette étape.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_1.1fr_1fr_120px] gap-3 px-5 py-3 border-b border-line text-[11px] uppercase tracking-[0.05em] text-muted bg-panel-2/60">
                    <div>Appel d&apos;offre</div>
                    <div>Client</div>
                    <div>Saisi par</div>
                    <div>Échéance</div>
                    <div>Statut</div>
                    <div>Avancement</div>
                    <div />
                  </div>
                  {pagedAos.map(ao => {
                    const st = dossierStatut(ao);
                    const prog = dossierProgress(ao);
                    const montant = dossierMontant(ao);
                    return (
                      <div
                        key={ao.id}
                        className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_1.1fr_1fr_120px] gap-3 items-center px-5 py-3.5 border-b border-line last:border-0 hover:bg-panel-2/60 transition group"
                      >
                        <div className="min-w-0 flex items-start gap-2">
                          <button
                            onClick={() => handleDownloadOriginal(ao)}
                            disabled={downloadingOriginalId === ao.id}
                            className="mt-0.5 shrink-0 text-muted hover:text-ai disabled:opacity-50 transition"
                            title="Télécharger le fichier déposé"
                          >
                            {downloadingOriginalId === ao.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Download size={14} />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-text truncate">{ao.filename}</p>
                            {montant && (
                              <p className="text-[11.5px] text-muted truncate mt-0.5">{montant}</p>
                            )}
                          </div>
                        </div>
                        {editingRowId === ao.id ? (
                          <input
                            value={ao.clientName}
                            onChange={e => updateAO(ao.id, { clientName: e.target.value })}
                            placeholder="Nom du client"
                            className="w-full text-[12.5px] text-text bg-panel border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-ai"
                          />
                        ) : (
                          <div className="text-[12.5px] text-text truncate">
                            {ao.clientName || <span className="text-muted">Non renseigné</span>}
                          </div>
                        )}
                        {editingRowId === ao.id ? (
                          <input
                            value={ao.owner}
                            onChange={e => updateAO(ao.id, { owner: e.target.value })}
                            placeholder="Saisi par"
                            className="w-full text-[12.5px] text-text bg-panel border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-ai"
                          />
                        ) : (
                          <div className="text-[12.5px] text-text truncate">
                            {ao.owner || <span className="text-muted">—</span>}
                          </div>
                        )}
                        {editingRowId === ao.id ? (
                          <input
                            type="date"
                            value={ao.deadline}
                            onChange={e => updateAO(ao.id, { deadline: e.target.value })}
                            className="w-full text-[12px] font-mono text-text bg-panel border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-ai"
                          />
                        ) : (
                          <div className="text-[12px] font-mono text-muted flex items-center gap-1 min-w-0">
                            <CalendarDays size={11} className="text-line shrink-0" />
                            <span className="truncate">{dossierEcheance(ao)}</span>
                          </div>
                        )}
                        <div>
                          <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium", st.cls)}>
                            {ao.status === "scoring" && <Loader2 size={10} className="animate-spin" />}
                            {ao.status === "scored" && ao.scoringResult && (
                              <span className="tabular-nums">{ao.scoringResult.score}/100 ·</span>
                            )}
                            {st.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 flex-1 rounded-full bg-panel-2">
                            <span
                              className={cn("absolute left-0 top-0 h-full rounded-full", prog >= 100 ? "bg-good" : "bg-ai")}
                              style={{ width: `${prog}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-muted tabular-nums w-9 text-right">{prog}%</span>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {editingRowId === ao.id ? (
                            <button
                              onClick={() => setEditingRowId(null)}
                              className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1.5 rounded-lg bg-good text-white hover:brightness-110 transition font-medium"
                              title="Terminer la modification"
                            >
                              <Check size={13} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingRowId(ao.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-line hover:text-ai transition"
                              title="Modifier client / saisi par / échéance"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => openDossier(ao.id)}
                            className="inline-flex items-center gap-1 text-[11.5px] px-3 py-1.5 rounded-lg bg-ai text-white hover:brightness-110 transition font-medium"
                          >
                            Ouvrir <ArrowRight size={12} />
                          </button>
                          <button
                            onClick={() => removeAO(ao.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-line hover:text-bad transition"
                            title="Supprimer ce dossier"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-line bg-panel-2/40 text-[12px] text-muted">
                      <span className="tabular-nums">
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredAos.length)} sur {filteredAos.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setHomePage(page - 1)}
                          disabled={page <= 1}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line hover:border-ai hover:text-ai disabled:opacity-40 disabled:pointer-events-none transition"
                        >
                          <ArrowLeft size={13} /> Préc.
                        </button>
                        <span className="font-mono tabular-nums px-2">Page {page} / {totalPages}</span>
                        <button
                          onClick={() => setHomePage(page + 1)}
                          disabled={page >= totalPages}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line hover:border-ai hover:text-ai disabled:opacity-40 disabled:pointer-events-none transition"
                        >
                          Suiv. <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <Modal open={showAddModal} onClose={() => setShowAddModal(false)} className="max-w-[560px] p-6">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-[16px] font-semibold text-text">Ajouter un appel d&apos;offres</h2>
            <button
              onClick={() => setShowAddModal(false)}
              className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-muted hover:border-ai hover:text-text"
            >
              Fermer ✕
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1.5 text-[11px] text-muted">Nom du client</div>
                <input
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="Ex. BSIC"
                  className="w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 text-[13px] text-text focus:border-ai focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-muted">Date d&apos;échéance</div>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={e => setNewDeadline(e.target.value)}
                  className="w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 text-[13px] text-text focus:border-ai focus:outline-none"
                />
              </div>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all bg-panel",
                dragOver
                  ? "border-ai bg-[#ececee]"
                  : "border-line hover:border-ai hover:bg-panel-2"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files, { clientName: newClientName.trim(), deadline: newDeadline });
                setShowAddModal(false);
                setNewClientName(""); setNewDeadline("");
              }}
            >
              <div className="w-14 h-14 rounded-xl bg-[#ececee] flex items-center justify-center mx-auto mb-3">
                <Upload size={24} className="text-ai" />
              </div>
              <p className="text-sm font-semibold text-text">Déposer un appel d&apos;offres</p>
              <p className="text-xs text-muted mt-1">
                PDF ou DOCX — max 10 Mo · Analyse automatique en 7 étapes
              </p>
              <button
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="mt-4 inline-flex items-center gap-1.5 text-xs px-4 py-2 bg-ai hover:brightness-95 text-white rounded-lg font-medium transition"
              >
                <Upload size={13} /> Choisir un fichier
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length) {
                    handleFiles(e.target.files, { clientName: newClientName.trim(), deadline: newDeadline });
                    setShowAddModal(false);
                    setNewClientName(""); setNewDeadline("");
                  }
                }}
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── Vue Kanban ────────────────────────────────────────────────────────────────
  if (pageView === "kanban") {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-panel-2">
        {/* Header Kanban */}
        <div className="shrink-0 px-6 py-3 bg-panel border-b flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold text-text">Pipeline Avant-vente</h1>
            <p className="text-xs text-muted mt-0.5">
              {statsAos.total} AO{statsAos.total > 1 ? "s" : ""} · {statsAos.won} gagné{statsAos.won > 1 ? "s" : ""} · {statsAos.lost} perdu{statsAos.lost > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-ai hover:brightness-95 text-white rounded-lg font-medium transition-colors"
            >
              <Upload size={12} /> Nouvel AO
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" multiple className="hidden"
              onChange={e => { if (e.target.files) handleFiles(e.target.files); setPageView("workflow"); }} />
            <div className="flex items-center rounded-lg border border-line overflow-hidden">
              <button onClick={() => setPageView("workflow")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-panel-2 transition-colors">
                <List size={13} /> Workflow
              </button>
              {/* <button onClick={() => setPageView("kanban")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-ai text-white">
                <LayoutGrid size={13} /> Pipeline
              </button> */}
            </div>
          </div>
        </div>

        {/* Colonnes Kanban */}
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 h-full min-w-max">
            {KANBAN_COLS.map(col => {
              const colAos = aos.filter(a => getKanbanColumn(a) === col.key);
              return (
                <div key={col.key} className="w-64 flex flex-col gap-2">
                  {/* Column header */}
                  <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", col.light)}>
                    <span className={cn("w-2 h-2 rounded-full", col.color)} />
                    <span className={cn("text-xs font-bold", col.text)}>{col.label}</span>
                    <span className={cn("ml-auto text-xs font-bold tabular-nums", col.text)}>{colAos.length}</span>
                  </div>
                  {/* Cards */}
                  <div className="flex flex-col gap-2 overflow-y-auto pb-2">
                    {colAos.length === 0 && (
                      <div className="rounded-xl border border-dashed border-line py-6 text-center text-xs text-line">
                        Aucun AO
                      </div>
                    )}
                    {colAos.map(ao => (
                      <div
                        key={ao.id}
                        onClick={() => { selectAO(ao.id); setPageView("workflow"); }}
                        className="rounded-xl border border-line bg-panel p-3 cursor-pointer hover: hover:-translate-y-0.5 transition-all group"
                      >
                        <p className="text-xs font-semibold text-text truncate mb-1">{ao.filename}</p>
                        {ao.clientName && <p className="text-xs text-muted truncate mb-1.5">{ao.clientName}</p>}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ao.scoringResult && (
                            <span className={cn("text-xs font-bold tabular-nums",
                              ao.scoringResult.score >= 70 ? "text-good" :
                              ao.scoringResult.score >= 40 ? "text-warn" : "text-bad"
                            )}>
                              {ao.scoringResult.score}/100
                            </span>
                          )}
                          {ao.decisionValidated && ao.decision && (
                            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium",
                              ao.decision === "go" ? "bg-good/15 text-good" :
                              ao.decision === "no_bid" ? "bg-bad/15 text-bad" : "bg-warn/15 text-warn"
                            )}>
                              {ao.decision === "go" ? "GO" : ao.decision === "no_bid" ? "NO-BID" : "COND."}
                            </span>
                          )}
                          {ao.scoringResult?.date_remise && (
                            <span className="ml-auto text-[10px] text-muted flex items-center gap-0.5">
                              <CalendarDays size={9} /> {ao.scoringResult.date_remise}
                            </span>
                          )}
                        </div>
                        {ao.result === "lost" && ao.competitor && (
                          <p className="text-[10px] text-muted mt-1.5 truncate">Gagnant : {ao.competitor}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-ink">
        {!selectedAO ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8">
            <div className="w-16 h-16 rounded-xl bg-panel-2 flex items-center justify-center">
              <FileText size={30} className="text-line" />
            </div>
            <div>
              <p className="font-semibold text-text text-base">Aucun dossier sélectionné</p>
              <p className="text-sm text-muted mt-1">Choisissez un dossier dans l&apos;historique pour l&apos;ouvrir.</p>
            </div>
            <button
              onClick={() => setPageView("home")}
              className="text-sm text-ai py-2 px-4 border border-[#deded7] rounded-xl hover:bg-[#ececee] transition-colors font-medium inline-flex items-center gap-1.5"
            >
              <List size={14} /> Retour à l&apos;historique
            </button>
          </div>
        ) : (
          <>
            {/* Header — même langage que la page d'accueil */}
            <div className="px-6 pt-5 pb-4 bg-ink shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => setPageView("home")}
                    className="mt-0.5 shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-line text-muted hover:text-ai hover:border-ai transition-colors"
                    title="Retour à l'historique"
                    aria-label="Retour à l'historique"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="min-w-0">
                    <div className="mb-1 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
                      ● Appel d'offre — dossier
                    </div>
                    <h1 className="text-xl font-semibold tracking-[-0.01em] text-text truncate">
                      {selectedAO.filename}
                    </h1>
                    <div className="mt-1 flex items-center gap-x-4 gap-y-1 flex-wrap text-[13px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <span>Client :</span>
                        <input
                          value={selectedAO.clientName}
                          onChange={e => updateAO(selectedAO.id, { clientName: e.target.value })}
                          placeholder="Saisir le nom du client..."
                          className="text-[13px] text-text bg-transparent border-b border-transparent hover:border-line focus:border-ai focus:outline-none px-1 min-w-0 w-40 placeholder:text-line"
                        />
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span>Saisi par :</span>
                        <input
                          value={selectedAO.owner ?? ""}
                          onChange={e => updateAO(selectedAO.id, { owner: e.target.value })}
                          placeholder="Nom de la personne..."
                          className="text-[13px] text-text bg-transparent border-b border-transparent hover:border-line focus:border-ai focus:outline-none px-1 min-w-0 w-40 placeholder:text-line"
                        />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {selectedAO.status === "scored" && selectedAO.scoringResult && (
                    <>
                      <span className={cn(
                        "text-lg font-bold tabular-nums",
                        selectedAO.scoringResult.score >= 70 ? "text-good" :
                        selectedAO.scoringResult.score >= 40 ? "text-warn" : "text-bad"
                      )}>
                        {selectedAO.scoringResult.score}/100
                      </span>
                      <RecoBadge rec={selectedAO.scoringResult.recommendation} />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* En attente d'analyse */}
            {selectedAO.status === "pending_analysis" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
                <div className="w-16 h-16 rounded-xl bg-[#ececee] flex items-center justify-center">
                  <Play size={28} className="text-ai" />
                </div>
                <div>
                  <p className="font-semibold text-text">Analyse pas encore lancée</p>
                  <p className="text-sm text-muted mt-1">Le fichier est prêt — démarrez l&apos;analyse IA quand vous le souhaitez.</p>
                </div>
                <button
                  onClick={() => startAnalysis(selectedAO.id)}
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-ai hover:brightness-95 text-white rounded-lg font-medium transition"
                >
                  <Play size={14} /> Démarrer l&apos;analyse
                </button>
              </div>
            )}

            {/* Loading */}
            {selectedAO.status === "scoring" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5">
                <div className="w-16 h-16 rounded-xl bg-[#ececee] flex items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-ai" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-text">Analyse de l'appel d'offres en cours...</p>
                  <p className="text-sm text-muted mt-1">Extraction · Résumé · Matching GED · Scoring</p>
                </div>
              </div>
            )}

            {/* Error */}
            {selectedAO.status === "error" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
                <div className="w-14 h-14 rounded-xl bg-bad/10 flex items-center justify-center">
                  <XCircle size={28} className="text-bad" />
                </div>
                <div className="space-y-2 max-w-md">
                  <p className="font-semibold text-bad">Échec de l'analyse</p>
                  <p className="text-sm text-text font-mono bg-panel-2 rounded-lg px-3 py-2 text-left break-words">
                    {selectedAO.errorMessage}
                  </p>
                  <p className="text-xs text-muted mt-2">
                    Relancez l&apos;analyse ci-dessous. Si le fichier n&apos;est plus disponible (page rechargée),
                    supprimez cette entrée et re-déposez le fichier.
                  </p>
                </div>
                <button
                  onClick={() => startAnalysis(selectedAO.id, true)}
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-ai hover:brightness-95 text-white rounded-lg font-medium transition"
                >
                  <Play size={14} /> Refaire l&apos;analyse
                </button>
              </div>
            )}

            {/* Scored */}
            {selectedAO.status === "scored" && (
              <>
                {/* Phase toggle — visible dès que la décision (GO/CONDITIONNEL) est validée */}
                {selectedAO.strategyValidated && selectedAO.decision !== "no_bid" && (
                  <div className="flex items-center gap-2 px-6 py-2 bg-ink shrink-0">
                    <button
                      onClick={() => {
                        const s = getActiveStep(selectedAO);
                        setViewStep(Math.min(Math.max(s, 1), 3) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        viewStep <= 3 ? "bg-ai text-white" : "bg-panel-2 text-muted hover:bg-line"
                      )}
                    >
                      Phase 1 — Analyse & Décision
                    </button>
                    <button
                      onClick={() => {
                        const s = getActiveStep(selectedAO);
                        setViewStep(Math.min(Math.max(s, 5), 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        viewStep >= 5 ? "bg-ai text-white" : "bg-panel-2 text-muted hover:bg-line"
                      )}
                    >
                      Phase 2 — Offre & Soumission
                    </button>
                  </div>
                )}
                <StepperBar
                  ao={selectedAO}
                  viewStep={viewStep}
                  onStepClick={s => setViewStep(s as 1 | 2 | 3 | 4 | 5 | 6 | 7)}
                  steps={viewStep >= 5 ? STEPS_P2 : STEPS_P1}
                />
                {exportError && (
                  <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 bg-bad/10 border border-bad/35 rounded-xl text-sm text-bad">
                    <XCircle size={15} className="shrink-0 text-bad" />
                    <span className="flex-1">{exportError}</span>
                    <button onClick={() => setExportError(null)} className="text-bad hover:text-bad text-xs shrink-0">✕</button>
                  </div>
                )}
                {exportSuccess && (
                  <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 bg-good/10 border border-good/35 rounded-xl text-sm text-good">
                    <CheckCircle size={15} className="shrink-0 text-good" />
                    <span>{exportSuccess}</span>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-5">
                  {viewStep === 1 && (
                    <Step1
                      ao={selectedAO}
                      onExport={() => handleExportAnalysis(selectedAO.id)}
                      exporting={exportingAnalysis}
                      onExportMatrix={() => handleExportMatrix(selectedAO.id)}
                      exportingMatrix={exportingMatrix}
                      onNext={() => setViewStep(2)}
                      onReanalyze={() => startAnalysis(selectedAO.id, true)}
                    />
                  )}
                  {viewStep === 2 && (
                    <Step2
                      ao={selectedAO}
                      onUpdate={patch => updateAO(selectedAO.id, patch)}
                      onValidate={() => handleValidateDecision(selectedAO.id)}
                      validating={validatingDecision}
                      onExport={() => handleExportScoring(selectedAO.id)}
                      exporting={exportingScoring}
                    />
                  )}
                  {viewStep === 3 && (
                    <Step3
                      ao={selectedAO}
                      generatingStrategy={generatingStrategy}
                      onValidate={() => {
                        updateAO(selectedAO.id, { strategyValidated: true });
                        setViewStep(5);
                      }}
                      onExport={() => handleExportStrategy(selectedAO.id)}
                      exporting={exportingStrategy}
                      onRegenerate={() => regenerateStrategy(selectedAO.id)}
                    />
                  )}
                  {viewStep === 5 && (
                    <Step5
                      ao={selectedAO}
                      onValidate={() => {
                        const items = selectedAO.checklist.length === 0 && selectedAO.scoringResult
                          ? generateChecklist(selectedAO.scoringResult)
                          : selectedAO.checklist;
                        updateAO(selectedAO.id, { offerValidated: true, checklist: items });
                        setViewStep(6);
                      }}
                      triggerDownload={triggerDownload}
                      onOfferReady={(filename) => updateAO(selectedAO.id, { offerGenerated: true, offerFilename: filename })}
                    />
                  )}
                  {viewStep === 6 && (
                    <Step6
                      ao={selectedAO}
                      onToggle={id => {
                        const updated = selectedAO.checklist.map(it =>
                          it.id === id ? { ...it, checked: !it.checked } : it
                        );
                        updateAO(selectedAO.id, { checklist: updated });
                      }}
                      onNoteChange={(id, note) => {
                        const updated = selectedAO.checklist.map(it =>
                          it.id === id ? { ...it, note } : it
                        );
                        updateAO(selectedAO.id, { checklist: updated });
                      }}
                      onAddItem={category => {
                        const newItem: ChecklistItem = {
                          id: genId(),
                          category,
                          label: "Nouvel élément",
                          required: false,
                          checked: false,
                          note: "",
                        };
                        updateAO(selectedAO.id, { checklist: [...selectedAO.checklist, newItem] });
                      }}
                      onDeleteItem={id => {
                        updateAO(selectedAO.id, { checklist: selectedAO.checklist.filter(it => it.id !== id) });
                      }}
                      onExport={() => handleExportChecklist(selectedAO.id)}
                      exporting={exportingChecklist}
                      onValidate={() => {
                        updateAO(selectedAO.id, { checklistValidated: true });
                        setViewStep(7);
                      }}
                    />
                  )}
                  {viewStep === 7 && (
                    <Step7
                      ao={selectedAO}
                      onUpdate={patch => updateAO(selectedAO.id, patch)}
                      onValidate={() => updateAO(selectedAO.id, { submissionValidated: true })}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
