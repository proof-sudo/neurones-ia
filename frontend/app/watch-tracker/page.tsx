"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Radar, RefreshCw, MapPin, ShieldAlert, TrendingUp, Zap, ArrowUpRight,
  Clock, Sparkles, X, Copy, Check, AlertTriangle, Target, Rss, Building2,
  RadioTower, Plus, Trash2, Globe, FileSearch,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
  fetchVeilleFeed, fetchVeilleSources, triggerVeilleScan,
  initVeilleDemoSources, patchVeilleEntry, generateVeillePitch, generateVeilleDebrief,
  addVeilleSource, deleteVeilleSource, getVeilleConfig, updateVeilleConfig,
  type VeilleSource,
} from "@/lib/api";
import {
  buildOpportunities, filterByRegion, computeThreatLevel, computePipeStats,
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
  const [debriefOpp, setDebriefOpp] = useState<Opportunity | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

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

          {/* Tour de contrôle — configuration de l'agent (thèmes, URLs, web) */}
          <button
            onClick={() => setPanelOpen(true)}
            title="Tour de contrôle de la veille"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#ecedf0] bg-white text-slate-600 hover:bg-slate-50 font-medium transition-colors"
          >
            <RadioTower size={13} className="text-[#0a2a43]" />
            Tour de contrôle
          </button>

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
        {/* Empty state global — DÉSACTIVÉ à la demande : on affiche toujours les
            3 colonnes, même sans données (plus de message "Aucun signal capté" /
            bouton "Démarrer avec les sources démo"). Bloc conservé en commentaire.
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
        */}
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
                    onCardClick={() => setDebriefOpp(opp)}
                  />
                ))}
              </div>
            </div>

            {/* Colonne droite : pipe commercial */}
            <PipeWidget pipe={pipe} />
          </div>
      </div>

      {/* ── Modal pitch ── */}
      {activeOpp && (
        <PitchModal
          opp={activeOpp}
          onClose={() => setActiveOpp(null)}
          onAvantVente={() => toAvantVente(activeOpp)}
        />
      )}

      {/* ── Tour de contrôle ── */}
      {panelOpen && (
        <ControlTowerPanel onClose={() => setPanelOpen(false)} onChanged={loadAll} />
      )}

      {/* ── Modal débriefing IA ── */}
      {debriefOpp && (
        <DebriefModal opp={debriefOpp} onClose={() => setDebriefOpp(null)} />
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
function OpportunityCard({
  opp, onPitch, onCardClick,
}: { opp: Opportunity; onPitch: () => void; onCardClick: () => void }) {
  const { entry, rule } = opp;
  const isAvantVente = entry.status === "in_presales";
  return (
    <div
      onClick={onCardClick}
      role="button"
      tabIndex={0}
      title="Cliquer pour le débriefing IA de cette opportunité"
      className="rounded-xl p-4 bg-white cursor-pointer hover:shadow-md hover:border-slate-300 transition-shadow"
      style={{ border: "1px solid #ecedf0" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
          <Building2 size={12} className="text-slate-400" />
          {rule.signalLabel}
          {entry.origin === "web" && (
            <span
              title="Trouvée par l'agent en explorant Internet"
              className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600"
            >
              <Globe size={9} /> Web
            </span>
          )}
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
          onClick={(e) => { e.stopPropagation(); onPitch(); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#0a2a43] text-white rounded-lg hover:brightness-110 font-medium transition-all"
        >
          <Sparkles size={12} /> Générer le pitch
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onCardClick(); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors"
        >
          <FileSearch size={12} /> Détail
        </button>
        {entry.url && (
          <a
            href={entry.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
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

        {/* Criticité moyenne — score IA réel de l'agent (remplace le CA fabriqué) */}
        <div className="rounded-xl p-4 bg-[#0a2a43] text-white">
          <p className="text-[11px] text-white/60 mb-1">Criticité moyenne du pipe</p>
          <p className="text-lg font-bold tabular-nums leading-tight">
            {pipe.criticiteMoyenne > 0 ? `${pipe.criticiteMoyenne}/100` : "—"}
          </p>
          <p className="text-[10px] text-white/50 mt-1">Score IA · signaux analysés par l&apos;agent</p>
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
  const [pitch, setPitch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Le pitch est généré par Claude côté backend à l'ouverture de la modale.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    generateVeillePitch(opp.entry.id)
      .then((txt) => { if (!cancelled) setPitch(txt); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [opp.entry.id]);

  async function copy() {
    if (!pitch) return;
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
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-8">
              <RefreshCw size={14} className="animate-spin" />
              L&apos;IA rédige le pitch…
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 py-8 text-center">
              Échec de génération du pitch. Réessaie dans un instant.
            </p>
          ) : (
            <div className="prose prose-sm max-w-none text-slate-700 text-sm [&_p]:my-1.5 [&_strong]:text-slate-900">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{pitch}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer modal */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={copy}
            disabled={loading || !pitch}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
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

// ── Modal : Débriefing IA de l'AO (lecture du lien direct via web_fetch) ──────
function DebriefModal({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  // Affichage instantané du débriefing pré-généré au scan — aucune génération ni
  // lecture web au clic. On lit simplement ce qui a été sauvegardé.
  const [debrief, setDebrief] = useState(opp.entry.debrief ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Backfill manuel (action explicite) : uniquement pour les entrées détectées
  // avant cette fonction, dont le débriefing est encore vide.
  async function generate() {
    setLoading(true);
    setError(false);
    try {
      setDebrief(await generateVeilleDebrief(opp.entry.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
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
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSearch size={15} className="text-[#0a2a43]" /> Débriefing IA de l&apos;AO
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{opp.entry.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Corps modal */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-8">
              <RefreshCw size={14} className="animate-spin" />
              L&apos;IA lit l&apos;annonce…
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 py-8 text-center">
              Échec du débriefing. Réessaie dans un instant.
            </p>
          ) : debrief ? (
            <div className="prose prose-sm max-w-none text-slate-700 text-sm [&_p]:my-1.5 [&_strong]:text-slate-900">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{debrief}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400 mb-3">
                Débriefing pas encore disponible pour cette opportunité (détectée avant l&apos;activation de cette fonction, ou sans lien exploitable).
              </p>
              <button
                onClick={generate}
                className="text-xs px-4 py-2 bg-[#0a2a43] text-white rounded-lg hover:brightness-110 font-medium transition-all"
              >
                Générer le débriefing
              </button>
            </div>
          )}
        </div>

        {/* Footer modal */}
        {opp.entry.url && (
          <div className="shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <a
              href={opp.entry.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0a2a43] font-medium"
            >
              Voir l&apos;annonce d&apos;origine <ArrowUpRight size={11} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tour de contrôle : configuration de l'agent de veille ─────────────────────
function ControlTowerPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [sources, setSources] = useState<VeilleSource[]>([]);
  const [themes, setThemes] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [feedType, setFeedType] = useState<"html" | "rss">("html");
  const [keywords, setKeywords] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [srcs, cfg] = await Promise.all([fetchVeilleSources(), getVeilleConfig()]);
      setSources(srcs);
      setThemes(cfg.themes);
      setWebSearch(cfg.web_search_enabled);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveConfig() {
    setSavingCfg(true);
    try { await updateVeilleConfig({ themes, web_search_enabled: webSearch }); }
    catch { /* ignore */ } finally { setSavingCfg(false); }
  }

  async function handleAdd() {
    if (!name.trim() || !url.trim()) return;
    setAdding(true);
    try {
      await addVeilleSource({ name: name.trim(), url: url.trim(), feed_type: feedType, keywords: keywords.trim() });
      setName(""); setUrl(""); setKeywords("");
      await load();
      onChanged();
    } catch { /* ignore */ } finally { setAdding(false); }
  }

  async function handleDelete(id: number) {
    try { await deleteVeilleSource(id); await load(); onChanged(); } catch { /* ignore */ }
  }

  const inputCls = "w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-[#0a2a43]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <RadioTower size={16} className="text-[#f26a21]" /> Tour de contrôle — Veille
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Thèmes prioritaires */}
          <section>
            <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Target size={13} className="text-[#0a2a43]" /> Sur quoi l&apos;agent se base
            </h4>
            <p className="text-[11px] text-slate-400 mb-2">
              Thèmes / secteurs prioritaires que l&apos;IA privilégie pour juger la pertinence et la criticité.
            </p>
            <textarea
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              rows={3}
              placeholder="Ex : infrastructure réseau, cybersécurité, cloud, datacenter, SD-WAN, marchés publics IT…"
              className={inputCls}
            />
          </section>

          {/* Exploration web */}
          <section className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Globe size={13} className="text-[#0a2a43]" /> Explorer Internet
              </span>
              <input
                type="checkbox"
                checked={webSearch}
                onChange={(e) => setWebSearch(e.target.checked)}
                className="w-4 h-4 accent-[#0a2a43] cursor-pointer"
              />
            </label>
            <p className="text-[11px] text-slate-400 mt-1.5">
              En plus de vos sources, laisser l&apos;agent chercher des opportunités sur le web.
            </p>
          </section>

          <button
            onClick={saveConfig}
            disabled={savingCfg}
            className="w-full text-xs px-3 py-2 bg-[#0a2a43] text-white rounded-lg hover:brightness-110 font-medium disabled:opacity-50 transition-all"
          >
            {savingCfg ? "Enregistrement…" : "Enregistrer la configuration"}
          </button>

          {/* Sources internes */}
          <section>
            <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Rss size={13} className="text-[#0a2a43]" /> Sources / URLs internes
            </h4>

            <div className="space-y-2 mb-3">
              {sources.length === 0 && (
                <p className="text-[11px] text-slate-400">Aucune source. Ajoutez vos URLs ci-dessous.</p>
              )}
              {sources.map((s) => (
                <div key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.url}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {s.feed_type.toUpperCase()}{s.keywords ? ` · ${s.keywords}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    title="Supprimer"
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Formulaire d'ajout */}
            <div className="space-y-2 rounded-lg bg-slate-50 p-3 border border-slate-100">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la source" className={inputCls} />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={inputCls} />
              <div className="flex gap-2">
                <select
                  value={feedType}
                  onChange={(e) => setFeedType(e.target.value as "html" | "rss")}
                  className="text-xs border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:border-[#0a2a43]"
                >
                  <option value="html">Page HTML</option>
                  <option value="rss">Flux RSS</option>
                </select>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="mots-clés, séparés, par virgules"
                  className={`${inputCls} flex-1`}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={adding || !name.trim() || !url.trim()}
                className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 bg-[#f26a21] text-white rounded-lg hover:brightness-95 font-medium disabled:opacity-50 transition-all"
              >
                <Plus size={13} /> {adding ? "Ajout…" : "Ajouter la source"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
