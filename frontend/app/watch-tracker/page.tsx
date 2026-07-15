"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Radar, RefreshCw, MapPin, ShieldAlert, TrendingUp, Zap, ArrowUpRight,
  Clock, Sparkles, X, Copy, Check, AlertTriangle, Target, Rss, Building2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
  fetchVeilleFeed, fetchVeilleSources, triggerVeilleScan,
  initVeilleDemoSources, patchVeilleEntry,
} from "@/lib/api";
import {
  buildOpportunities, filterByRegion, computeThreatLevel, computePipeStats,
  buildPitch, formatFcfa,
  type Opportunity, type Priority, type Region, type ThreatLevel,
} from "@/lib/watch-tracker";

// ── Badges ────────────────────────────────────────────────────────────────────
const PRIORITY_STYLE: Record<Priority, string> = {
  CRITIQUE: "bg-red-100 text-red-700",
  ELEVEE: "bg-amber-100 text-amber-700",
  MOYENNE: "bg-slate-100 text-slate-600",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  CRITIQUE: "Critique", ELEVEE: "Élevée", MOYENNE: "Moyenne",
};

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full", PRIORITY_STYLE[priority])}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const THREAT_STYLE: Record<ThreatLevel, { dot: string; text: string; label: string }> = {
  FAIBLE: { dot: "bg-green-500", text: "text-green-700", label: "Faible" },
  MODERE: { dot: "bg-amber-500", text: "text-amber-700", label: "Modéré" },
  ELEVE: { dot: "bg-red-500", text: "text-red-700", label: "Élevé" },
};

// ── Page ────────────────────────────────────────────────────────────────────
export default function WatchTrackerPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [sourcesCount, setSourcesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [region, setRegion] = useState<Region>("all");
  const [activeOpp, setActiveOpp] = useState<Opportunity | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [feed, srcs] = await Promise.all([
        fetchVeilleFeed(100, ""),
        fetchVeilleSources(),
      ]);
      setOpps(buildOpportunities(feed));
      setSourcesCount(srcs.length);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleScan() {
    setScanning(true);
    try {
      await triggerVeilleScan();
      await loadAll();
    } catch { /* ignore */ } finally {
      setScanning(false);
    }
  }

  async function handleInitDemo() {
    await initVeilleDemoSources();
    await loadAll();
  }

  const toAvantVente = useCallback(async (opp: Opportunity) => {
    const id = opp.entry.id;
    // Optimiste : on met à jour localement puis on persiste.
    setOpps((prev) => prev.map((o) =>
      o.entry.id === id ? { ...o, entry: { ...o.entry, status: "in_presales" } } : o,
    ));
    setActiveOpp((cur) =>
      cur && cur.entry.id === id ? { ...cur, entry: { ...cur.entry, status: "in_presales" } } : cur,
    );
    try { await patchVeilleEntry(id, "in_presales"); } catch { /* ignore */ }
  }, []);

  // Opportunités filtrées par région (mémoïsé).
  const visible = useMemo(() => filterByRegion(opps, region), [opps, region]);
  const signals = useMemo(
    () => [...opps].sort((a, b) =>
      new Date(b.entry.detected_at).getTime() - new Date(a.entry.detected_at).getTime()),
    [opps],
  );
  const threat = useMemo(() => computeThreatLevel(opps), [opps]);
  const pipe = useMemo(() => computePipeStats(opps), [opps]);
  const threatStyle = THREAT_STYLE[threat];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#f7f8fa" }}>
      {/* ── Header ── */}
      <div
        className="shrink-0 px-6 py-4 sticky top-0 z-10 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: "#f7f8fa", borderBottom: "1px solid #ecedf0" }}
      >
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-none flex items-center gap-2">
            <Radar className="w-4 h-4 text-[#0a2a43]" strokeWidth={1.75} /> S2I Watch-Tracker
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {pipe.detectees} opportunité{pipe.detectees > 1 ? "s" : ""} active
            {pipe.detectees > 1 ? "s" : ""} ·{" "}
            <span className="font-semibold text-red-600">{pipe.critiques} critique{pipe.critiques > 1 ? "s" : ""}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sélecteur de région */}
          <div className="flex items-center rounded-lg border border-[#ecedf0] bg-white overflow-hidden">
            {([
              ["all", "Toute la CI"],
              ["abidjan", "District d'Abidjan"],
              ["interieur", "Intérieur"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRegion(val)}
                className={cn(
                  "text-xs px-3 py-1.5 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
                  region === val ? "bg-[#0a2a43] text-white" : "text-slate-600 hover:bg-slate-50",
                )}
              >
                {val === "abidjan" && <MapPin size={11} />}
                {label}
              </button>
            ))}
          </div>

          {/* Indicateur menace ARTCI */}
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[#ecedf0] bg-white">
            <ShieldAlert size={13} className="text-slate-400" />
            <span className="text-slate-500">Menace ARTCI</span>
            <span className={cn("flex items-center gap-1 font-semibold", threatStyle.text)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", threatStyle.dot)} />
              {threatStyle.label}
            </span>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#f26a21] hover:brightness-95 text-white rounded-lg font-medium disabled:opacity-50 transition-all"
          >
            <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scan en cours..." : "Scanner maintenant"}
          </button>
        </div>
      </div>

      {/* ── Corps : 3 colonnes ── */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden">
        {/* Empty state global */}
        {!loading && opps.length === 0 ? (
          <div className="max-w-md mx-auto mt-16 rounded-xl p-10 text-center bg-white" style={{ border: "1px solid #ecedf0" }}>
            <Radar size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-600 mb-1">Aucun signal capté</p>
            <p className="text-sm text-slate-400 mb-4">
              {sourcesCount === 0
                ? "Ajoutez des sources de veille pour commencer à capter les signaux du marché ivoirien."
                : "Lancez un scan pour capter les signaux ARTCI, marchés publics et emploi."}
            </p>
            <button
              onClick={sourcesCount === 0 ? handleInitDemo : handleScan}
              className="text-xs px-4 py-2 bg-[#0a2a43] text-white rounded-lg hover:brightness-110 font-medium transition-all"
            >
              {sourcesCount === 0 ? "Démarrer avec les sources démo" : "Scanner maintenant"}
            </button>
          </div>
        ) : (
          <div className="h-full lg:grid lg:grid-cols-[300px_1fr_320px] lg:divide-x lg:divide-[#ecedf0]">
            {/* Colonne gauche : flux de signaux actifs */}
            <SignalFeed signals={signals} loading={loading} />

            {/* Colonne centrale : cartes d'opportunités */}
            <div className="lg:overflow-y-auto">
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-[#0a2a43]" />
                  <h2 className="text-sm font-bold text-slate-800">Opportunités actionnables</h2>
                  <span className="text-[11px] text-slate-400">({visible.length})</span>
                </div>

                {!loading && visible.length === 0 && (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    Aucune opportunité pour cette région.
                  </p>
                )}

                {visible.map((opp) => (
                  <OpportunityCard
                    key={opp.entry.id}
                    opp={opp}
                    onPitch={() => setActiveOpp(opp)}
                  />
                ))}
              </div>
            </div>

            {/* Colonne droite : pipe commercial */}
            <PipeWidget pipe={pipe} />
          </div>
        )}
      </div>

      {/* ── Modal pitch ── */}
      {activeOpp && (
        <PitchModal
          opp={activeOpp}
          onClose={() => setActiveOpp(null)}
          onAvantVente={() => toAvantVente(activeOpp)}
        />
      )}
    </div>
  );
}

// ── Colonne gauche : Flux de Signaux Actifs ───────────────────────────────────
function SignalFeed({ signals, loading }: { signals: Opportunity[]; loading: boolean }) {
  return (
    <div className="lg:overflow-y-auto bg-white/40">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Rss size={14} className="text-[#0a2a43]" />
          <h2 className="text-sm font-bold text-slate-800">Flux de signaux actifs</h2>
        </div>
        {loading && <p className="text-xs text-slate-400">Chargement…</p>}
        <div className="space-y-2">
          {signals.map((o) => (
            <div
              key={o.entry.id}
              className="rounded-lg p-3 bg-white"
              style={{ border: "1px solid #ecedf0" }}
            >
              <div className="flex items-start gap-2">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                  o.rule.priority === "CRITIQUE" ? "bg-red-500"
                    : o.rule.priority === "ELEVEE" ? "bg-amber-500" : "bg-slate-300",
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 leading-snug line-clamp-2">{o.entry.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(o.entry.detected_at).toLocaleDateString("fr-FR")}
                    </span>
                    {o.matched && (
                      <span className="text-[10px] text-[#0a2a43] font-medium">{o.rule.offreShort}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Colonne centrale : Carte d'Opportunité Actionnable ────────────────────────
function OpportunityCard({ opp, onPitch }: { opp: Opportunity; onPitch: () => void }) {
  const { entry, rule } = opp;
  const isAvantVente = entry.status === "in_presales";
  return (
    <div
      className="rounded-xl p-4 bg-white"
      style={{ border: "1px solid #ecedf0" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
          <Building2 size={12} className="text-slate-400" />
          {rule.signalLabel}
        </span>
        <PriorityBadge priority={rule.priority} />
      </div>

      <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-3 line-clamp-2">{entry.title}</h3>

      {/* Chaîne signal → risque → offre */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-600 leading-snug"><span className="font-semibold text-slate-500">Risque : </span>{rule.risque}</p>
        </div>
        <div className="flex items-start gap-2">
          <Zap size={13} className="text-[#0a2a43] mt-0.5 shrink-0" />
          <p className="text-xs text-slate-600 leading-snug"><span className="font-semibold text-slate-500">Offre S2I : </span>{rule.offre}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <button
          onClick={onPitch}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#0a2a43] text-white rounded-lg hover:brightness-110 font-medium transition-all"
        >
          <Sparkles size={12} /> Générer le pitch
        </button>
        {entry.url && (
          <a
            href={entry.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0a2a43] font-medium"
          >
            Source <ArrowUpRight size={11} />
          </a>
        )}
        {isAvantVente && (
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            En avant-vente
          </span>
        )}
      </div>
    </div>
  );
}

// ── Colonne droite : Suivi du Pipe Commercial S2I ─────────────────────────────
function PipeWidget({ pipe }: { pipe: ReturnType<typeof computePipeStats> }) {
  const rows = [
    { label: "Signaux détectés", value: pipe.detectees, icon: Radar },
    { label: "Signaux critiques", value: pipe.critiques, icon: ShieldAlert },
    { label: "En avant-vente", value: pipe.enAvantVente, icon: TrendingUp },
  ];
  return (
    <div className="lg:overflow-y-auto bg-white/40">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-[#0a2a43]" />
          <h2 className="text-sm font-bold text-slate-800">Pipe commercial S2I</h2>
        </div>

        <div className="space-y-2 mb-4">
          {rows.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg p-3 bg-white" style={{ border: "1px solid #ecedf0" }}>
              <Icon size={15} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500 flex-1">{label}</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">{value}</span>
            </div>
          ))}
        </div>

        {/* CA récurrent estimé */}
        <div className="rounded-xl p-4 bg-[#0a2a43] text-white">
          <p className="text-[11px] text-white/60 mb-1">CA récurrent estimé (avant-vente)</p>
          <p className="text-lg font-bold tabular-nums leading-tight">{formatFcfa(pipe.caRecurrentEstime)}</p>
          <p className="text-[10px] text-white/50 mt-1">Services managés · estimation annuelle indicative</p>
        </div>
      </div>
    </div>
  );
}

// ── Modal : Pitch d'avant-vente ────────────────────────────────────────────────
function PitchModal({
  opp, onClose, onAvantVente,
}: { opp: Opportunity; onClose: () => void; onAvantVente: () => void }) {
  const [copied, setCopied] = useState(false);
  const pitch = useMemo(() => buildPitch(opp), [opp]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pitch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header modal */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={15} className="text-[#f26a21]" /> Pitch d&apos;avant-vente
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{opp.rule.offreShort} · priorité {PRIORITY_LABEL[opp.rule.priority].toLowerCase()}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Corps modal */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="prose prose-sm max-w-none text-slate-700 text-sm [&_p]:my-1.5 [&_strong]:text-slate-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{pitch}</ReactMarkdown>
          </div>
        </div>

        {/* Footer modal */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors"
          >
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            {copied ? "Copié" : "Copier"}
          </button>
          <button
            onClick={onAvantVente}
            disabled={opp.entry.status === "in_presales"}
            className="ml-auto flex items-center gap-1.5 text-xs px-4 py-2 bg-[#0a2a43] text-white rounded-lg hover:brightness-110 font-medium disabled:opacity-50 transition-all"
          >
            <TrendingUp size={13} />
            {opp.entry.status === "in_presales" ? "Déjà en avant-vente" : "Passer en avant-vente"}
          </button>
        </div>
      </div>
    </div>
  );
}
