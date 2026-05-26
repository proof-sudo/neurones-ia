"use client";
import { useState, useRef, useEffect } from "react";
import React from "react";
import {
  Upload, FileText, CheckCircle, XCircle, AlertCircle, AlertTriangle,
  Download, Loader2, Trash2, Sparkles, ArrowRight, Shield, Target,
  Users, Eye, ClipboardList, BarChart2, Layers, Lock, Plus, Send,
  CalendarDays, Trophy, ThumbsDown, Clock, LayoutGrid, List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  scoreAO, generateBidStrategy, exportAnalysis, exportScoring, exportStrategy,
  generateOffer, exportChecklist,
  type ScoringResult, type BidStrategy,
} from "@/lib/api";
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
  status: "scoring" | "scored" | "error";
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

function getStorageKey(): string {
  if (typeof window === "undefined") return "neurones_presales_aos_v2";
  try {
    const raw = localStorage.getItem("neurones_user");
    const uid = raw ? (JSON.parse(raw) as { id: number }).id : 0;
    return `neurones_presales_${uid}_v2`;
  } catch {
    return "neurones_presales_aos_v2";
  }
}

function newEntry(id: string, filename: string): AOEntry {
  return {
    id, filename,
    addedAt: new Date().toISOString(),
    clientName: "",
    status: "scoring",
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
  if (!ao.responsePlanValidated) return 4;
  if (!ao.offerValidated) return 5;
  if (!ao.checklistValidated) return 6;
  return 7;
}

function canViewStep(ao: AOEntry, step: number): boolean {
  if (!ao.scoringResult) return false;
  if (step === 1 || step === 2) return true;
  if (step === 3) return ao.decisionValidated && ao.decision !== "no_bid";
  if (step === 4) return ao.strategyValidated;
  const phase1Done = ao.responsePlanValidated && ao.decision !== "no_bid";
  if (step === 5) return phase1Done;
  if (step === 6) return phase1Done && ao.offerValidated;
  if (step === 7) return phase1Done && ao.checklistValidated;
  return false;
}

function isStepDone(ao: AOEntry, step: number): boolean {
  if (step === 1) return !!ao.scoringResult;
  if (step === 2) return ao.decisionValidated;
  if (step === 3) return ao.strategyValidated;
  if (step === 4) return ao.responsePlanValidated;
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
    items.push({ id: uid(), category: "Technique", label: `CV — ${res}`, required: true, checked: false, note: "" });
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
    const lp = p.toLowerCase();
    if (docKeywords.some(k => lp.includes(k))) {
      items.push({ id: uid(), category: "Administratif", label: p, required: true, checked: false, note: "" });
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
  risks: ["Certifications Azure/AWS à renforcer", "Délai serré pour un scope large", "Sous-estimation possible du volet formation"],
  score: 78,
  recommendation: "GO",
  justification: "Profil bien adapté avec références bancaires comparables. Gap cloud public manageable avec sous-traitance partielle.",
  criteres_selection: ["Expérience cloud hybride > 5 ans", "Certifications VMware + Azure/AWS requises", "Références bancaires CI obligatoires"],
  besoins: ["Virtualisation infrastructure (50+ serveurs)", "Solution Disaster Recovery multi-site", "Formation équipes IT BSIC"],
  prerequis: ["Présence locale CI obligatoire", "Capacité financière justifiée (bilan 3 ans)", "Assurance décennale active"],
  ressources_demandees: ["Chef de projet PMP/Prince2", "Expert VMware VCP", "Architecte cloud Azure/AWS certifié", "Formateur certifié"],
  points_vigilance: ["Clause pénalité 0.5%/semaine de retard", "Délai très court pour périmètre large", "Transfert de compétences obligatoire"],
  date_remise: "15 juin 2026",
};

// ── Shared mini-components ────────────────────────────────────────────────────

function SectionCard({ title, icon, children, className }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 p-4 shadow-sm", className)}>
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}

function BulletList({ items, bulletColor = "text-blue-500" }: {
  items?: string[]; bulletColor?: string;
}) {
  if (!items?.length) return <p className="text-sm text-gray-400 italic">Non précisé</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
          <span className={cn("mt-1 text-xs shrink-0", bulletColor)}>●</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function WarningList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm text-gray-400 italic">Aucun point identifié</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RecoBadge({ rec }: { rec: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    GO: { cls: "bg-green-100 text-green-700 border-green-300", label: "GO ✓" },
    CONDITIONAL: { cls: "bg-amber-100 text-amber-700 border-amber-300", label: "CONDITIONNEL ⚡" },
    NO_BID: { cls: "bg-red-100 text-red-700 border-red-300", label: "NO-BID ✗" },
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
    green: "border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400",
    amber: "border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400",
    red: "border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400",
  };
  const sel = {
    green: "bg-green-100 border-green-500 text-green-800 font-bold shadow-sm",
    amber: "bg-amber-100 border-amber-500 text-amber-800 font-bold shadow-sm",
    red: "bg-red-100 border-red-500 text-red-800 font-bold shadow-sm",
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
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#f59e0b" : "#dc2626";
  const textColor = score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-500" : "text-red-600";

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 104, height: 104 }}>
      <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
        <circle cx="52" cy="52" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
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
        <span className="text-xs text-slate-400 block mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

const STEPS_P1 = [
  { num: 1, label: "Analyse AO" },
  { num: 2, label: "Score & Décision" },
  { num: 3, label: "Stratégie" },
  { num: 4, label: "Plan de réponse" },
];
const STEPS_P2 = [
  { num: 5, label: "Offre technique" },
  { num: 6, label: "Checklist dossier" },
  { num: 7, label: "Soumission" },
];

function StepperBar({ ao, viewStep, onStepClick, steps }: {
  ao: AOEntry; viewStep: number;
  onStepClick: (s: number) => void;
  steps: { num: number; label: string }[];
}) {
  return (
    <div className="flex items-center px-6 py-3 border-b bg-white gap-1 shrink-0">
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
                accessible && !current ? "hover:bg-slate-50 cursor-pointer" : "",
                !accessible ? "cursor-not-allowed" : ""
              )}
            >
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                done && !current ? "bg-green-500 text-white" :
                current ? "bg-blue-600 text-white shadow-sm" :
                accessible ? "border-2 border-slate-300 text-slate-500" :
                "bg-gray-100 text-gray-400"
              )}>
                {done && !current ? "✓" : step.num}
              </span>
              <span className={cn(
                "text-xs font-medium transition-colors",
                current ? "text-blue-600" :
                done ? "text-green-600" :
                accessible ? "text-slate-600" :
                "text-gray-400"
              )}>
                {step.label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 min-w-[12px] rounded-full transition-colors",
                isStepDone(ao, step.num) ? "bg-green-300" : "bg-gray-200"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step content ──────────────────────────────────────────────────────────────

function Step1({ ao, onExport, exporting, onNext }: {
  ao: AOEntry; onExport: () => void; exporting: boolean; onNext: () => void;
}) {
  const r = ao.scoringResult!;
  return (
    <div className="space-y-4">
      <SectionCard title="Résumé exécutif" icon={<FileText size={15} />}>
        <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.summary}</ReactMarkdown>
        </div>
      </SectionCard>

      {(r.key_elements?.length ?? 0) > 0 && (
        <SectionCard title="Points clés identifiés par l'IA" icon={<BarChart2 size={15} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {r.key_elements.map((el, i) => (
              <div key={i} className="flex gap-3 bg-slate-50 rounded-lg p-2.5 text-sm border border-slate-100">
                <span className="text-slate-400 font-medium min-w-[110px] shrink-0 text-xs leading-relaxed pt-0.5">{el.category}</span>
                <span className="text-slate-800 font-medium text-xs leading-relaxed">{el.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {(r.criteres_selection?.length ?? 0) > 0 && (
        <SectionCard title="Critères de sélection" icon={<ClipboardList size={15} />}>
          <BulletList items={r.criteres_selection} bulletColor="text-blue-500" />
        </SectionCard>
      )}

      {(r.besoins?.length ?? 0) > 0 && (
        <SectionCard title="Besoins identifiés" icon={<Target size={15} />}>
          <BulletList items={r.besoins} bulletColor="text-indigo-500" />
        </SectionCard>
      )}

      {(r.prerequis?.length ?? 0) > 0 && (
        <SectionCard title="Prérequis" icon={<Shield size={15} />}>
          <BulletList items={r.prerequis} bulletColor="text-slate-500" />
        </SectionCard>
      )}

      {(r.ressources_demandees?.length ?? 0) > 0 && (
        <SectionCard title="Ressources demandées" icon={<Users size={15} />}>
          <BulletList items={r.ressources_demandees} bulletColor="text-purple-500" />
        </SectionCard>
      )}

      {(r.points_vigilance?.length ?? 0) > 0 && (
        <SectionCard title="Points de vigilance" icon={<Eye size={15} />}>
          <WarningList items={r.points_vigilance} />
        </SectionCard>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 hover:border-slate-300 disabled:opacity-50 transition-colors shadow-sm"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exporter en Word
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
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
    cv: "bg-violet-100 text-violet-600",
    offre_technique: "bg-blue-100 text-blue-600",
    abe: "bg-amber-100 text-amber-700",
    pv_recette: "bg-green-100 text-green-700",
  };

  const teamMatches = r.team_matches ?? [];
  const similarProjects = r.similar_projects ?? [];

  return (
    <div className="space-y-4">
      {/* Score principal */}
      <SectionCard title="Score de matching GED" icon={<Layers size={15} />}>
        <div className="flex items-center gap-8 flex-wrap">
          <ScoreRing score={r.score} />
          <div className="space-y-3 flex-1 min-w-[200px]">
            <RecoBadge rec={r.recommendation} />
            {r.justification && !r.justification.startsWith("{") && !r.justification.startsWith("```") && (
              <p className="text-sm text-slate-600 leading-relaxed">{r.justification}</p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Matching équipe — CVs depuis la GED */}
      <SectionCard
        title={`Équipe proposable (${teamMatches.length} CV${teamMatches.length !== 1 ? "s" : ""} matchés)`}
        icon={<Users size={15} className="text-violet-500" />}
      >
        {teamMatches.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-1">
            {(r.ressources_demandees?.length ?? 0) > 0
              ? "Aucun CV correspondant dans la GED pour ces profils."
              : "L'AO ne précise pas de profils spécifiques."}
          </p>
        ) : (
          <div className="space-y-2">
            {(r.ressources_demandees?.length ?? 0) > 0 && (
              <p className="text-[11px] text-slate-400 italic mb-2">
                Profils demandés : {r.ressources_demandees!.slice(0, 4).join(" · ")}
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
                <div key={i} className="flex items-start gap-3 p-2.5 bg-violet-50 rounded-lg border border-violet-100">
                  <div className="w-8 h-8 rounded-lg bg-violet-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-violet-700">
                    {initials || "CV"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-700 truncate">{name}</span>
                      <span className={cn(
                        "text-[11px] font-bold shrink-0 px-1.5 py-0.5 rounded-full",
                        doc.relevance_score >= 0.7 ? "bg-green-100 text-green-700" :
                        doc.relevance_score >= 0.4 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {Math.round(doc.relevance_score * 100)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{doc.excerpt}</p>
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
        icon={<FileText size={15} className="text-blue-500" />}
      >
        {similarProjects.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-1">Aucun projet similaire trouvé dans la GED.</p>
        ) : (
          <div className="space-y-2">
            {similarProjects.map((doc, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700 truncate">{doc.filename}</span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium",
                      docTypeColor[doc.doc_type] ?? "bg-slate-100 text-slate-500"
                    )}>
                      {docTypeLabel[doc.doc_type] ?? doc.doc_type}
                    </span>
                    <span className="text-xs text-green-600 font-bold shrink-0">
                      {Math.round(doc.relevance_score * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.excerpt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionCard title="Nos forces" icon={<CheckCircle size={15} />} className="border-green-100">
          <BulletList items={r.strengths} bulletColor="text-green-500" />
        </SectionCard>
        <SectionCard title="Risques identifiés" icon={<AlertTriangle size={15} />} className="border-red-100">
          <BulletList items={r.risks} bulletColor="text-red-500" />
        </SectionCard>
      </div>

      {r.gaps_analysis && !r.gaps_analysis.startsWith("{") && !r.gaps_analysis.startsWith("```") && (
        <SectionCard title="Analyse des écarts">
          <div className="prose prose-sm max-w-none text-slate-600">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.gaps_analysis}</ReactMarkdown>
          </div>
        </SectionCard>
      )}

      <div className="flex justify-end">
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 hover:border-slate-300 disabled:opacity-50 transition-colors shadow-sm"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exporter le scoring
        </button>
      </div>

      {!ao.decisionValidated ? (
        <SectionCard title="Ma décision commerciale" className="border-blue-100 bg-blue-50/30">
          <p className="text-xs text-slate-500 mb-3">Sur la base de l'analyse, quelle est votre décision ?</p>
          <div className="flex gap-3 mb-4">
            <DecisionBtn label="GO ✓" colorKey="green" selected={ao.decision === "go"} onClick={() => onUpdate({ decision: "go" })} />
            <DecisionBtn label="CONDITIONNEL ⚡" colorKey="amber" selected={ao.decision === "conditional"} onClick={() => onUpdate({ decision: "conditional" })} />
            <DecisionBtn label="NO-BID ✗" colorKey="red" selected={ao.decision === "no_bid"} onClick={() => onUpdate({ decision: "no_bid" })} />
          </div>
          <textarea
            value={ao.decisionReason}
            onChange={e => onUpdate({ decisionReason: e.target.value })}
            placeholder="Justification de la décision (optionnel)..."
            className="w-full text-sm border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            rows={2}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={onValidate}
              disabled={!ao.decision || validating}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
            >
              {validating && <Loader2 size={14} className="animate-spin" />}
              {validating ? "Génération en cours..." : "Valider ma décision"}
              {!validating && <ArrowRight size={14} />}
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Décision validée" className="border-green-200 bg-green-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle size={18} className="text-green-600" />
            </div>
            <div>
              <span className="font-semibold text-slate-700">
                {ao.decision === "go" ? "GO — Répondre à cet AO" : ao.decision === "conditional" ? "CONDITIONNEL — Sous réserve" : "NO-BID — Ne pas répondre"}
              </span>
              {ao.decisionReason && (
                <p className="text-sm text-slate-500 mt-0.5">{ao.decisionReason}</p>
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function Step3({ ao, generatingStrategy, onStrategyTextChange, onValidate, onExport, exporting }: {
  ao: AOEntry;
  generatingStrategy: boolean;
  onStrategyTextChange: (text: string) => void;
  onValidate: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  if (generatingStrategy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Sparkles size={32} className="text-blue-500 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-700">Génération de la stratégie de réponse...</p>
          <p className="text-sm text-slate-400 mt-1.5">L'IA analyse votre AO et vos références GED</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!ao.bidStrategy) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertCircle size={40} className="text-amber-400" />
        <p className="text-slate-500">La génération de la stratégie a échoué.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Stratégie de réponse" icon={<Sparkles size={15} />}>
        <p className="text-xs text-slate-400 mb-2.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          Générée par IA — modifiable avant validation.
        </p>
        <textarea
          value={ao.strategyText}
          onChange={e => !ao.strategyValidated && onStrategyTextChange(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-xl p-3 resize-none bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200 leading-relaxed"
          rows={10}
          readOnly={ao.strategyValidated}
        />
      </SectionCard>

      {(ao.bidStrategy.chronogram?.length ?? 0) > 0 && (
        <SectionCard title="Chronogramme de traitement" icon={<ClipboardList size={15} />}>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs whitespace-nowrap">Période</th>
                  <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs">Action</th>
                  <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs whitespace-nowrap">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {ao.bidStrategy.chronogram.map((item, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-blue-600 font-semibold text-xs whitespace-nowrap">{item.semaine}</td>
                    <td className="py-2.5 px-3 text-slate-700 text-sm">{item.action}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{item.responsable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium border border-slate-200 hover:border-slate-300 disabled:opacity-50 transition-colors shadow-sm"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exporter en Word
        </button>

        {!ao.strategyValidated ? (
          <button
            onClick={onValidate}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <CheckCircle size={14} />
            Valider la stratégie
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 rounded-xl px-4 py-2.5 border border-green-100">
            <CheckCircle size={16} /> Stratégie validée
          </div>
        )}
      </div>
    </div>
  );
}

function Step4({ ao, onPlanChange, onValidate, onStartPhase2 }: {
  ao: AOEntry;
  onPlanChange: (text: string) => void;
  onValidate: () => void;
  onStartPhase2: () => void;
}) {
  if (ao.responsePlanValidated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
        <div className="w-20 h-20 rounded-2xl bg-green-50 flex items-center justify-center shadow-inner">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <div>
          <p className="text-xl font-bold text-slate-700">Phase 1 complète !</p>
          <p className="text-sm text-slate-400 mt-2 max-w-xs">
            Analyse, décision, stratégie et plan de réponse sont finalisés.
          </p>
        </div>
        <button
          onClick={onStartPhase2}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm mt-2"
        >
          <Sparkles size={15} />
          Démarrer Phase 2 — Offre & Soumission
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Plan de réponse" icon={<ClipboardList size={15} />}>
        <p className="text-xs text-slate-400 mb-2.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Pré-rempli à partir de la stratégie validée. Modifiez avant de valider.
        </p>
        <textarea
          value={ao.responsePlan}
          onChange={e => onPlanChange(e.target.value)}
          placeholder="Le plan de réponse sera généré automatiquement à partir de votre stratégie..."
          className="w-full text-sm border border-slate-200 rounded-xl p-3 resize-none bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-200 leading-relaxed placeholder:text-slate-300"
          rows={14}
        />
      </SectionCard>
      <div className="flex justify-end">
        <button
          onClick={onValidate}
          disabled={!ao.responsePlan.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          <CheckCircle size={14} />
          Valider → Phase 2
        </button>
      </div>
    </div>
  );
}

// ── Step 5 — Offre technique ──────────────────────────────────────────────────

function Step5({ ao, onGenerate, onDownload, onValidate, generating }: {
  ao: AOEntry;
  onGenerate: () => void;
  onDownload: () => void;
  onValidate: () => void;
  generating: boolean;
}) {
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Sparkles size={32} className="text-blue-500 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-700">Génération de l'offre technique...</p>
          <p className="text-sm text-slate-400 mt-1.5">Notre IA rédige les sections de l'offre à partir de votre GED</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Génération de l'offre technique" icon={<FileText size={15} />}>
        <p className="text-sm text-slate-500 leading-relaxed mb-3">
          L'offre technique est générée automatiquement par IA à partir de votre AO et de vos références GED.
          Elle inclut : <span className="text-slate-600 font-medium">Compréhension du besoin · Approche méthodologique · Présentation équipe · Références similaires · Planning · Conditions commerciales.</span>
        </p>
        {ao.scoringResult && (
          <div className="flex items-center gap-2 mb-4">
            <RecoBadge rec={ao.scoringResult.recommendation} />
            <span className="text-xs text-slate-400">Décision : {ao.decision === "go" ? "GO ✓" : "CONDITIONNEL ⚡"}</span>
          </div>
        )}

        {!ao.offerGenerated ? (
          <div className="flex flex-col items-center gap-4 py-8 border border-dashed border-slate-200 rounded-xl">
            <FileText size={36} className="text-slate-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">L'offre n'a pas encore été générée</p>
              <p className="text-xs text-slate-400 mt-1">Durée estimée : 20-30 secondes</p>
            </div>
            <button
              onClick={onGenerate}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Sparkles size={15} />
              Générer l'offre technique
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700">Offre générée avec succès</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{ao.offerFilename}</p>
            </div>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 transition-colors shrink-0"
            >
              <Download size={12} /> Télécharger
            </button>
          </div>
        )}
      </SectionCard>

      <div className="flex items-center justify-between pt-1">
        {ao.offerGenerated && !ao.offerValidated ? (
          <button
            onClick={onValidate}
            className="ml-auto flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <CheckCircle size={14} />
            Valider l'offre → Étape 6
            <ArrowRight size={14} />
          </button>
        ) : ao.offerValidated ? (
          <div className="ml-auto flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 rounded-xl px-4 py-2.5 border border-green-100">
            <CheckCircle size={16} /> Offre validée
          </div>
        ) : null}
      </div>
    </div>
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
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const catConfig: { key: "Technique" | "Administratif" | "Commercial"; color: string; border: string; icon: React.ReactNode }[] = [
    { key: "Technique", color: "text-blue-600", border: "border-blue-100", icon: <FileText size={14} className="text-blue-400" /> },
    { key: "Administratif", color: "text-slate-600", border: "border-slate-200", icon: <Shield size={14} className="text-slate-400" /> },
    { key: "Commercial", color: "text-amber-600", border: "border-amber-100", icon: <Target size={14} className="text-amber-400" /> },
  ];

  const requiredItems = ao.checklist.filter(it => it.required);
  const checkedRequired = requiredItems.filter(it => it.checked);
  const allRequiredDone = requiredItems.length > 0 && checkedRequired.length === requiredItems.length;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Complétude du dossier</span>
          <span className={cn("text-sm font-bold", allRequiredDone ? "text-green-600" : "text-slate-500")}>
            {checkedRequired.length}/{requiredItems.length} obligatoires
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-2 rounded-full transition-all", allRequiredDone ? "bg-green-500" : "bg-blue-500")}
            style={{ width: `${requiredItems.length > 0 ? (checkedRequired.length / requiredItems.length) * 100 : 0}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          {ao.checklist.filter(it => it.checked).length}/{ao.checklist.length} items totaux cochés
        </p>
      </div>

      {catConfig.map(({ key, color, border, icon }) => {
        const items = ao.checklist.filter(it => it.category === key);
        return (
          <SectionCard key={key} title={key} icon={icon} className={cn("border", border)}>
            <div className="space-y-1.5">
              {items.map(item => (
                <div key={item.id} className="rounded-lg border border-slate-100 overflow-hidden">
                  <div className="flex items-center gap-2.5 p-2.5">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => onToggle(item.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer shrink-0 accent-blue-600"
                    />
                    <span className={cn(
                      "flex-1 text-xs leading-relaxed",
                      item.checked ? "line-through text-slate-400" : "text-slate-700",
                      item.required ? "font-medium" : ""
                    )}>
                      {item.label}
                    </span>
                    {item.required && (
                      <Lock size={10} className="shrink-0 text-slate-300" />
                    )}
                    <button
                      onClick={() => toggleNote(item.id)}
                      className="shrink-0 p-0.5 text-slate-300 hover:text-blue-500 transition-colors"
                      title="Ajouter une note"
                    >
                      <Eye size={12} />
                    </button>
                    {!item.required && (
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="shrink-0 p-0.5 text-slate-300 hover:text-red-500 transition-colors"
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
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-200 placeholder:text-slate-300"
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
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium border border-slate-200 hover:border-slate-300 disabled:opacity-50 transition-colors shadow-sm"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exporter la checklist
        </button>
        {!ao.checklistValidated ? (
          <button
            onClick={onValidate}
            disabled={!allRequiredDone}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors shadow-sm"
          >
            <CheckCircle size={14} />
            Valider le dossier → Étape 7
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 rounded-xl px-4 py-2.5 border border-green-100">
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
        <SectionCard title="Dossier soumis" icon={<Send size={15} />} className="border-green-200 bg-green-50/40">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-700">AO soumis avec succès</p>
              <p className="text-sm text-slate-500">
                <span className="font-medium">Date :</span> {ao.submissionDate ? new Date(ao.submissionDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
              </p>
              <p className="text-sm text-slate-500">
                <span className="font-medium">Canal :</span> {ao.submissionChannel}
              </p>
              {ao.submissionNote && (
                <p className="text-sm text-slate-500 italic mt-1">"{ao.submissionNote}"</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Résultat de l'AO */}
        <SectionCard title="Résultat de l'AO" icon={<Trophy size={15} />} className="border-violet-100 bg-violet-50/20">
          {ao.result && ao.result !== "pending" ? (
            <div className={cn(
              "flex items-start gap-4 p-3 rounded-xl",
              ao.result === "won" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                ao.result === "won" ? "bg-green-100" : "bg-red-100"
              )}>
                {ao.result === "won"
                  ? <Trophy size={20} className="text-green-600" />
                  : <ThumbsDown size={20} className="text-red-500" />}
              </div>
              <div className="space-y-1">
                <p className={cn("font-bold text-sm", ao.result === "won" ? "text-green-700" : "text-red-700")}>
                  {ao.result === "won" ? "🏆 AO Gagné !" : "AO Perdu"}
                </p>
                {ao.resultDate && <p className="text-xs text-slate-500">Le {new Date(ao.resultDate).toLocaleDateString("fr-FR")}</p>}
                {ao.competitor && <p className="text-xs text-slate-500">Concurrent gagnant : <span className="font-medium">{ao.competitor}</span></p>}
                {ao.resultNote && <p className="text-xs text-slate-500 italic mt-1">"{ao.resultNote}"</p>}
              </div>
              <button
                onClick={() => onUpdate({ result: null, competitor: "", resultNote: "", resultDate: "" })}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 shrink-0"
              >
                Modifier
              </button>
            </div>
          ) : ao.result === "pending" ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Clock size={16} className="text-amber-500 shrink-0" />
              <p className="text-sm font-medium text-amber-700 flex-1">Résultat en attente...</p>
              <button
                onClick={() => onUpdate({ result: null })}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Modifier
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Avez-vous reçu le résultat de cet appel d'offres ?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdate({ result: "won", resultDate: new Date().toISOString().split("T")[0] })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
                >
                  <Trophy size={14} /> Gagné 🏆
                </button>
                <button
                  onClick={() => onUpdate({ result: "lost", resultDate: new Date().toISOString().split("T")[0] })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm"
                >
                  <ThumbsDown size={14} /> Perdu
                </button>
                <button
                  onClick={() => onUpdate({ result: "pending" })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
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
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-100 bg-white"
                  />
                  <textarea
                    placeholder="Raison / retour client (optionnel)"
                    value={ao.resultNote}
                    onChange={e => onUpdate({ resultNote: e.target.value })}
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-100 bg-white placeholder:text-slate-300"
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
      <SectionCard title="Informations de soumission" icon={<CalendarDays size={15} />} className="border-blue-100 bg-blue-50/20">
        <div className="space-y-4">
          {dateRemise && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Date limite AO :</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-semibold border border-cyan-200">
                <CalendarDays size={11} />
                {dateRemise}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Date de soumission effective <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={ao.submissionDate}
              onChange={e => onUpdate({ submissionDate: e.target.value })}
              className="w-full sm:w-60 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
            {lateWarning && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1.5">
                <AlertTriangle size={12} /> Date après la limite de remise de l'AO
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Canal de dépôt <span className="text-red-400">*</span>
            </label>
            <select
              value={ao.submissionChannel}
              onChange={e => onUpdate({ submissionChannel: e.target.value })}
              className="w-full sm:w-72 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
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
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Note de suivi (optionnel)</label>
            <textarea
              value={ao.submissionNote}
              onChange={e => onUpdate({ submissionNote: e.target.value })}
              placeholder="Interlocuteur, accusé de réception, numéro de dépôt..."
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white placeholder:text-slate-300"
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          onClick={onValidate}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors shadow-sm"
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
  { key: "analyse",   label: "En analyse",   color: "bg-blue-500",   light: "bg-blue-50 border-blue-200",   text: "text-blue-700" },
  { key: "redaction", label: "En rédaction",  color: "bg-violet-500", light: "bg-violet-50 border-violet-200", text: "text-violet-700" },
  { key: "soumis",    label: "Soumis",        color: "bg-cyan-500",   light: "bg-cyan-50 border-cyan-200",   text: "text-cyan-700" },
  { key: "gagne",     label: "Gagnés 🏆",    color: "bg-green-500",  light: "bg-green-50 border-green-200", text: "text-green-700" },
  { key: "perdu",     label: "Perdus",        color: "bg-red-400",    light: "bg-red-50 border-red-200",     text: "text-red-700" },
] as const;

export default function PresalesPage() {
  const [aos, setAos] = useState<AOEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewStep, setViewStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [pageView, setPageView] = useState<"workflow" | "kanban">("workflow");
  const [dragOver, setDragOver] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [validatingDecision, setValidatingDecision] = useState(false);
  const [exportingAnalysis, setExportingAnalysis] = useState(false);
  const [exportingScoring, setExportingScoring] = useState(false);
  const [exportingStrategy, setExportingStrategy] = useState(false);
  const [exportingChecklist, setExportingChecklist] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoLoaded = useRef(false);
  const offerBlobRef = useRef<{ id: string; blob: Blob; filename: string } | null>(null);

  const selectedAO = aos.find(a => a.id === selectedId) ?? null;

  useEffect(() => {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
      try { setAos(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (aos.length > 0) localStorage.setItem(getStorageKey(), JSON.stringify(aos));
  }, [aos]);

  function updateAO(id: string, patch: Partial<AOEntry>) {
    setAos(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }

  async function handleFiles(files: FileList | File[]) {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) continue;
      const id = genId();
      const entry = newEntry(id, file.name);
      setAos(prev => [entry, ...prev]);
      setSelectedId(id);
      setViewStep(1);
      try {
        const result = await scoreAO(file);
        setAos(prev => prev.map(a => a.id === id ? { ...a, status: "scored", scoringResult: result } : a));
        setViewStep(1);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setAos(prev => prev.map(a => a.id === id ? { ...a, status: "error", errorMessage: msg } : a));
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
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
    setAos(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (aos.filter(a => a.id !== id).length === 0) {
      localStorage.removeItem(getStorageKey());
    }
  }

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
        strategyText: strategy.strategy,
        responsePlan: strategy.response_plan,
      });
    } catch (e) {
      console.error("Strategy generation failed:", e);
    } finally {
      setGeneratingStrategy(false);
      setValidatingDecision(false);
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
      console.log("Export stratégie → requête backend...");
      const blob = await exportStrategy(
        ao.scoringResult,
        ao.strategyText,
        ao.bidStrategy.chronogram,
        ao.responsePlan,
        ao.clientName || undefined,
        ao.decision === "go" ? "GO" : ao.decision === "conditional" ? "CONDITIONAL" : "NO_BID",
      );
      console.log("Export stratégie → blob reçu", blob.size, "octets, type:", blob.type);
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

  async function handleGenerateOffer(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult) return;
    updateAO(aoId, { offerGenerating: true });
    setExportError(null);
    try {
      const blob = await generateOffer(ao.scoringResult, ao.clientName || undefined);
      const filename = `Offre-Technique_${ao.clientName ? ao.clientName + "_" : ""}${ao.filename.replace(/\.(pdf|docx)$/i, "")}.docx`;
      offerBlobRef.current = { id: aoId, blob, filename };
      triggerDownload(blob, filename);
      updateAO(aoId, { offerGenerating: false, offerGenerated: true, offerFilename: filename });
      setExportSuccess("Offre générée — téléchargement lancé.");
      window.setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(msg);
      updateAO(aoId, { offerGenerating: false });
    }
  }

  function handleDownloadOffer(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao) return;
    if (offerBlobRef.current?.id === aoId) {
      triggerDownload(offerBlobRef.current.blob, offerBlobRef.current.filename);
    } else {
      handleGenerateOffer(aoId);
    }
  }

  async function handleExportChecklist(aoId: string) {
    const ao = aos.find(a => a.id === aoId);
    if (!ao?.scoringResult) return;
    setExportError(null);
    setExportingChecklist(true);
    try {
      const blob = await exportChecklist(
        ao.scoringResult.ao_filename,
        ao.checklist,
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

  // ── Score / decision helpers for list
  function scoreColor(s: number) {
    return s >= 70 ? "text-green-600" : s >= 40 ? "text-amber-500" : "text-red-500";
  }
  const decisionLabel: Record<string, string> = { go: "GO", no_bid: "NO-BID", conditional: "COND." };
  const decisionBadgeClass: Record<string, string> = {
    go: "bg-green-100 text-green-700",
    no_bid: "bg-red-100 text-red-700",
    conditional: "bg-amber-100 text-amber-700",
  };
  // ── Stats rapides pour le header ─────────────────────────────────────────────
  const statsAos = {
    total: aos.length,
    won: aos.filter(a => a.result === "won").length,
    lost: aos.filter(a => a.result === "lost").length,
    submitted: aos.filter(a => a.submissionValidated && !a.result).length,
    inProgress: aos.filter(a => !a.submissionValidated && a.status === "scored").length,
  };

  // ── Vue Kanban ────────────────────────────────────────────────────────────────
  if (pageView === "kanban") {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Header Kanban */}
        <div className="shrink-0 px-6 py-3 bg-white border-b flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold text-slate-800">Pipeline Avant-vente</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {statsAos.total} AO{statsAos.total > 1 ? "s" : ""} · {statsAos.won} gagné{statsAos.won > 1 ? "s" : ""} · {statsAos.lost} perdu{statsAos.lost > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Upload size={12} /> Nouvel AO
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" multiple className="hidden"
              onChange={e => { e.target.files && handleFiles(e.target.files); setPageView("workflow"); }} />
            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
              <button onClick={() => setPageView("workflow")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                <List size={13} /> Workflow
              </button>
              <button onClick={() => setPageView("kanban")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 text-white">
                <LayoutGrid size={13} /> Pipeline
              </button>
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
                      <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">
                        Aucun AO
                      </div>
                    )}
                    {colAos.map(ao => (
                      <div
                        key={ao.id}
                        onClick={() => { selectAO(ao.id); setPageView("workflow"); }}
                        className="rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
                      >
                        <p className="text-xs font-semibold text-slate-700 truncate mb-1">{ao.filename}</p>
                        {ao.clientName && <p className="text-xs text-slate-400 truncate mb-1.5">{ao.clientName}</p>}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ao.scoringResult && (
                            <span className={cn("text-xs font-bold tabular-nums",
                              ao.scoringResult.score >= 70 ? "text-green-600" :
                              ao.scoringResult.score >= 40 ? "text-amber-500" : "text-red-500"
                            )}>
                              {ao.scoringResult.score}/100
                            </span>
                          )}
                          {ao.decisionValidated && ao.decision && (
                            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium",
                              ao.decision === "go" ? "bg-green-100 text-green-700" :
                              ao.decision === "no_bid" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {ao.decision === "go" ? "GO" : ao.decision === "no_bid" ? "NO-BID" : "COND."}
                            </span>
                          )}
                          {ao.scoringResult?.date_remise && (
                            <span className="ml-auto text-[10px] text-slate-400 flex items-center gap-0.5">
                              <CalendarDays size={9} /> {ao.scoringResult.date_remise}
                            </span>
                          )}
                        </div>
                        {ao.result === "lost" && ao.competitor && (
                          <p className="text-[10px] text-slate-400 mt-1.5 truncate">Gagnant : {ao.competitor}</p>
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
      {/* ── Left panel ── */}
      <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="px-4 py-3.5 border-b shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-slate-800">Avant-vente</h1>
            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
              <button onClick={() => setPageView("workflow")}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white">
                <List size={11} /> Workflow
              </button>
              <button onClick={() => setPageView("kanban")}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                <LayoutGrid size={11} /> Pipeline
              </button>
            </div>
          </div>
          {statsAos.total > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="text-green-600 font-bold">{statsAos.won} gagné{statsAos.won > 1 ? "s" : ""}</span>
              <span>·</span>
              <span className="text-blue-500 font-bold">{statsAos.submitted} soumis</span>
              <span>·</span>
              <span>{statsAos.inProgress} en cours</span>
            </div>
          )}
        </div>

        {/* Upload zone */}
        <div
          className={cn(
            "m-3 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all shrink-0",
            dragOver
              ? "border-blue-400 bg-blue-50 scale-[0.98]"
              : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload size={20} className="text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-600">Déposer un AO</p>
          <p className="text-xs text-slate-400 mt-0.5">PDF ou DOCX — max 10 Mo</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {aos.length === 0 && (
          <button
            onClick={loadDemo}
            className="mx-3 mb-2 text-xs text-blue-600 hover:text-blue-700 text-center py-2 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors shrink-0 font-medium"
          >
            ✨ Charger un AO démo
          </button>
        )}

        {/* AO list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {aos.map(ao => (
            <div
              key={ao.id}
              onClick={() => selectAO(ao.id)}
              className={cn(
                "p-2.5 rounded-xl cursor-pointer transition-colors group",
                selectedId === ao.id
                  ? "bg-blue-50 border border-blue-200"
                  : "hover:bg-slate-50 border border-transparent"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{ao.filename}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(ao.addedAt).toLocaleDateString("fr-FR")}
                    {ao.clientName && <span className="ml-1 text-slate-500">— {ao.clientName}</span>}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeAO(ao.id); }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {ao.status === "scoring" && (
                  <span className="flex items-center gap-1 text-xs text-blue-500">
                    <Loader2 size={10} className="animate-spin" /> Analyse...
                  </span>
                )}
                {ao.status === "error" && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle size={10} /> Erreur
                  </span>
                )}
                {ao.status === "scored" && ao.scoringResult && (
                  <>
                    <span className={cn("text-xs font-bold", scoreColor(ao.scoringResult.score))}>
                      {ao.scoringResult.score}/100
                    </span>
                    {ao.decisionValidated && ao.decision && (
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", decisionBadgeClass[ao.decision])}>
                        {decisionLabel[ao.decision]}
                      </span>
                    )}
                  {ao.result === "won" ? (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">🏆 Gagné</span>
                  ) : ao.result === "lost" ? (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-600">Perdu</span>
                  ) : ao.result === "pending" ? (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">En attente</span>
                  ) : ao.submissionValidated ? (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Soumis</span>
                  ) : getActiveStep(ao) >= 5 ? (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">P2</span>
                  ) : (
                    <span className="text-xs text-slate-400 ml-auto">Ét. {getActiveStep(ao)}/4</span>
                  )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {!selectedAO ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner">
              <FileText size={30} className="text-slate-300" />
            </div>
            <div>
              <p className="font-semibold text-slate-600 text-base">Sélectionnez ou déposez un appel d'offres</p>
              <p className="text-sm text-slate-400 mt-1">PDF ou DOCX — Analyse automatique en 4 étapes</p>
            </div>
            {aos.length === 0 && (
              <button
                onClick={loadDemo}
                className="text-sm text-blue-600 hover:text-blue-700 py-2 px-4 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors font-medium"
              >
                ✨ Essayer avec l'AO démo BSIC
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-3 bg-white border-b flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-800 truncate">{selectedAO.filename}</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-slate-400">Client :</span>
                  <input
                    value={selectedAO.clientName}
                    onChange={e => updateAO(selectedAO.id, { clientName: e.target.value })}
                    placeholder="Saisir le nom du client..."
                    className="text-xs text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none px-1 min-w-0 w-40 placeholder:text-slate-300"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {selectedAO.status === "scored" && selectedAO.scoringResult && (
                  <>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      selectedAO.scoringResult.score >= 70 ? "text-green-600" :
                      selectedAO.scoringResult.score >= 40 ? "text-amber-500" : "text-red-600"
                    )}>
                      {selectedAO.scoringResult.score}/100
                    </span>
                    <RecoBadge rec={selectedAO.scoringResult.recommendation} />
                  </>
                )}
              </div>
            </div>

            {/* Loading */}
            {selectedAO.status === "scoring" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-blue-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-700">Analyse de l'appel d'offres en cours...</p>
                  <p className="text-sm text-slate-400 mt-1">Extraction · Résumé · Matching GED · Scoring</p>
                </div>
              </div>
            )}

            {/* Error */}
            {selectedAO.status === "error" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                  <XCircle size={28} className="text-red-400" />
                </div>
                <div className="space-y-2 max-w-md">
                  <p className="font-semibold text-red-600">Échec de l'analyse</p>
                  <p className="text-sm text-slate-600 font-mono bg-slate-100 rounded-lg px-3 py-2 text-left break-words">
                    {selectedAO.errorMessage}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Supprimez cette entrée (icône poubelle) et re-déposez le fichier pour réessayer.
                  </p>
                </div>
              </div>
            )}

            {/* Scored */}
            {selectedAO.status === "scored" && (
              <>
                {/* Phase toggle — visible when Phase 1 is complete and decision is not no_bid */}
                {selectedAO.responsePlanValidated && selectedAO.decision !== "no_bid" && (
                  <div className="flex items-center gap-2 px-6 py-2 border-b bg-white shrink-0">
                    <button
                      onClick={() => {
                        const s = getActiveStep(selectedAO);
                        setViewStep(Math.min(Math.max(s, 1), 4) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        viewStep <= 4 ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                        viewStep >= 5 ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                  <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <XCircle size={15} className="shrink-0 text-red-500" />
                    <span className="flex-1">{exportError}</span>
                    <button onClick={() => setExportError(null)} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
                  </div>
                )}
                {exportSuccess && (
                  <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                    <CheckCircle size={15} className="shrink-0 text-green-500" />
                    <span>{exportSuccess}</span>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-5">
                  {viewStep === 1 && (
                    <Step1
                      ao={selectedAO}
                      onExport={() => handleExportAnalysis(selectedAO.id)}
                      exporting={exportingAnalysis}
                      onNext={() => setViewStep(2)}
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
                      onStrategyTextChange={text => updateAO(selectedAO.id, { strategyText: text })}
                      onValidate={() => {
                        updateAO(selectedAO.id, { strategyValidated: true });
                        setViewStep(4);
                      }}
                      onExport={() => handleExportStrategy(selectedAO.id)}
                      exporting={exportingStrategy}
                    />
                  )}
                  {viewStep === 4 && (
                    <Step4
                      ao={selectedAO}
                      onPlanChange={text => updateAO(selectedAO.id, { responsePlan: text })}
                      onValidate={() => updateAO(selectedAO.id, { responsePlanValidated: true })}
                      onStartPhase2={() => setViewStep(5)}
                    />
                  )}
                  {viewStep === 5 && (
                    <Step5
                      ao={selectedAO}
                      onGenerate={() => handleGenerateOffer(selectedAO.id)}
                      onDownload={() => handleDownloadOffer(selectedAO.id)}
                      onValidate={() => {
                        const items = selectedAO.checklist.length === 0 && selectedAO.scoringResult
                          ? generateChecklist(selectedAO.scoringResult)
                          : selectedAO.checklist;
                        updateAO(selectedAO.id, { offerValidated: true, checklist: items });
                        setViewStep(6);
                      }}
                      generating={selectedAO.offerGenerating}
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
