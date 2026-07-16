"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MessageSquare, FileSearch, AlertTriangle, FolderOpen, Users,
  FileText, TrendingUp, Zap, RefreshCw, ArrowUpRight, CheckCircle2,
  BarChart3, Clock, Trophy, Send, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchStats, type DashboardStats } from "@/lib/api";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; loading: boolean;
}) {
  return (
    <div className="rounded-xl p-5 bg-white" style={{ border: "1px solid #ecedf0" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <Icon className="w-4 h-4 text-slate-300" strokeWidth={1.75} />
      </div>
      <p className={cn(
        "text-2xl font-semibold tracking-tight leading-none",
        loading ? "text-slate-200 animate-pulse" : "text-slate-900"
      )}>
        {value}
      </p>
      {sub && (
        <p className={cn("text-xs mt-1.5 font-medium", loading ? "text-slate-200" : "text-slate-400")}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Module card ───────────────────────────────────────────────────────────────

function ModuleCard({ href, icon: Icon, title, description, tags, tagStyle }: {
  href: string; icon: React.ElementType; title: string; description: string;
  tags: string[]; tagStyle: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl p-6 flex flex-col gap-4 bg-white transition-colors hover:border-slate-300"
      style={{ border: "1px solid #ecedf0" }}
    >
      <div className="flex items-start justify-between">
        <Icon className="w-5 h-5 text-[#0a2a43] shrink-0" strokeWidth={1.75} />
        <ArrowUpRight className="w-4 h-4 text-slate-300 transition-colors group-hover:text-slate-500" />
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className={cn("text-[11px] px-2 py-0.5 rounded-md font-medium", tagStyle)}>
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const gedFolders = [
  { name: "CVs ingénieurs",      icon: Users,       key: "cvs" },
  { name: "Offres techniques",   icon: FileText,    key: "offres" },
  { name: "Procédures internes", icon: FolderOpen,  key: "procedures" },
  { name: "PV de recette",       icon: CheckCircle2, key: "pv" },
  { name: "Comptes-rendus",      icon: FileText,    key: "cr" },
  { name: "Fiches techniques",   icon: BarChart3,   key: "fiches" },
];

interface RoiMetrics {
  aosAnalyzed: number;
  proposalsGenerated: number;
  submitted: number;
  won: number;
  hoursSaved: number;
}

function loadRoiMetrics(): RoiMetrics {
  try {
    const raw = localStorage.getItem("neurones_user");
    const uid = raw ? (JSON.parse(raw) as { id: number }).id : 0;
    const key = `neurones_presales_${uid}_v2`;
    const saved = localStorage.getItem(key);
    if (!saved) return { aosAnalyzed: 0, proposalsGenerated: 0, submitted: 0, won: 0, hoursSaved: 0 };
    const aos = JSON.parse(saved) as Array<{
      scoringResult?: unknown;
      offerValidated?: boolean;
      submissionValidated?: boolean;
      result?: string;
    }>;
    const aosAnalyzed = aos.filter(a => a.scoringResult).length;
    const proposalsGenerated = aos.filter(a => a.offerValidated).length;
    const submitted = aos.filter(a => a.submissionValidated).length;
    const won = aos.filter(a => a.result === "won").length;
    const hoursSaved = aosAnalyzed * 2 + proposalsGenerated * 4;
    return { aosAnalyzed, proposalsGenerated, submitted, won, hoursSaved };
  } catch { return { aosAnalyzed: 0, proposalsGenerated: 0, submitted: 0, won: 0, hoursSaved: 0 }; }
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [roi, setRoi] = useState<RoiMetrics>({ aosAnalyzed: 0, proposalsGenerated: 0, submitted: 0, won: 0, hoursSaved: 0 });
  const [dateStr, setDateStr] = useState("");

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchStats();
      setStats(data);
      setLastRefresh(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setRoi(loadRoiMetrics());
    setDateStr(new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }));
  }, []);

  const statCards = [
    {
      label: "Clients actifs",
      value: stats ? fmt(stats.clients) : "—",
      icon: Users,
    },
    {
      label: "Factures émises",
      value: stats ? fmt(stats.invoices_total) : "—",
      sub: stats ? `${fmt(stats.invoices_paid)} payées` : undefined,
      icon: FileText,
    },
    {
      label: "Bons de commande",
      value: stats ? fmt(stats.sale_orders) : "—",
      icon: TrendingUp,
    },
    {
      label: "Opportunités CRM",
      value: stats ? fmt(stats.opportunities) : "—",
      icon: Zap,
    },
  ];

  return (
    <div
      className="flex flex-col h-full overflow-y-auto scrollbar-thin"
      style={{ background: "#f7f8fa" }}
    >
      {/* ── Top bar ───────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between"
        style={{
          background: "#f7f8fa",
          borderBottom: "1px solid #ecedf0",
        }}
      >
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-none">Tableau de bord</h1>
          <p className="text-xs text-slate-400 mt-0.5 capitalize font-medium">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !error && stats && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
              style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">Odoo connecté</span>
            </div>
          )}
          {lastRefresh && (
            <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3" />
              {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-slate-600 font-medium disabled:opacity-50 transition-colors hover:bg-slate-100"
            style={{ border: "1px solid #ecedf0" }}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-4"
            style={{
              background: "#fdeceb",
              border: "1px solid #f3c7c2",
            }}
          >
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Service temporairement indisponible</p>
              <p className="text-xs text-red-600 mt-0.5">
                Le serveur ne répond pas. Réessayez dans quelques instants ou contactez l&apos;administrateur.
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Données Odoo en direct
            </h2>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((s) => (
              <StatCard key={s.label} {...s} loading={loading} />
            ))}
          </div>
        </section>

        {/* ROI IA */}
        {roi.aosAnalyzed > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Économies réalisées ce mois
              </h2>
              <Link href="/presales" className="text-[11px] text-[#0a2a43] font-semibold hover:underline flex items-center gap-0.5">
                Voir le pipeline <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div
              className="rounded-xl p-5 bg-white"
              style={{
                border: "1px solid #ecedf0",
                boxShadow: "none",
              }}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "AOs analysés", value: roi.aosAnalyzed, icon: BarChart3 },
                  { label: "Offres générées", value: roi.proposalsGenerated, icon: FileText },
                  { label: "Dossiers soumis", value: roi.submitted, icon: Send },
                  { label: "AOs gagnés", value: roi.won, icon: Trophy },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} />
                    <div>
                      <p className="text-xl font-semibold text-slate-900 leading-none">{value}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <p className="text-xs text-slate-600">
                  Temps économisé estimé :{" "}
                  <span className="font-semibold text-slate-900">{roi.hoursSaved}h</span>
                  {" "}≈{" "}
                  <span className="font-semibold text-slate-900">
                    {(roi.hoursSaved * 75000).toLocaleString("fr-FR")} XOF
                  </span>
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Modules */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Modules IA disponibles
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-md text-slate-500 bg-slate-100">
              2 actifs
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <ModuleCard
              href="/chat"
              icon={MessageSquare}
              title="Connaissance interne"
              description="Posez des questions sur vos documents GED et vos données clients Odoo. Joignez un fichier pour l'analyser."
              tags={["RAG hybride", "Odoo live", "GED"]}
              tagStyle="bg-slate-100 text-slate-600 border border-slate-200"
            />
            <ModuleCard
              href="/presales"
              icon={FileSearch}
              title="Avant-vente IA"
              description="Scorez un appel d'offres, générez votre stratégie de réponse et votre offre technique en Word."
              tags={["Scoring AO", "Matching GED", "Offre Word"]}
              tagStyle="bg-slate-100 text-slate-600 border border-slate-200"
            />
          </div>
        </section>

        {/* GED */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Base documentaire (GED)
            </h2>
            <Link
              href="/ged"
              className="text-[11px] text-[#0a2a43] font-semibold hover:underline flex items-center gap-0.5"
            >
              Gérer <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div
            className="rounded-xl px-4 py-3 mb-3 flex items-start gap-2.5"
            style={{
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.25)",
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Déposez vos fichiers dans{" "}
              <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">data/ged/</code> puis lancez{" "}
              <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">python scripts/initial_ingest.py</code>{" "}
              pour initialiser le RAG hybride.
            </p>
          </div>

          <div
            className="rounded-xl overflow-hidden bg-white"
            style={{
              border: "1px solid #ecedf0",
              boxShadow: "none",
            }}
          >
            {gedFolders.map((f, i) => (
              <div
                key={f.name}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5",
                  i !== gedFolders.length - 1 && "border-b border-slate-100"
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                  <f.icon className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <p className="flex-1 text-sm text-slate-700 font-medium">{f.name}</p>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                  0 fichier
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
