"use client";
import { useState, useEffect } from "react";
import {
  Rss, RefreshCw, Eye, Archive, ArrowUpRight, Plus, Trash2,
  Search, Zap, Clock, Calendar, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchVeilleFeed, fetchVeilleStats, fetchVeilleSources,
  addVeilleSource, deleteVeilleSource, patchVeilleEntry,
  triggerVeilleScan, initVeilleDemoSources,
  type VeilleEntry, type VeilleSource,
} from "@/lib/api";

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn(
      "text-[11px] font-bold px-2 py-0.5 rounded-full",
      score >= 70 ? "bg-green-100 text-green-700" :
      score >= 40 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
    )}>
      {score}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    read: "bg-slate-100 text-slate-500",
    archived: "bg-slate-100 text-slate-400",
    in_presales: "bg-violet-100 text-violet-700",
  };
  const labels: Record<string, string> = {
    new: "Nouveau", read: "Lu", archived: "Archivé", in_presales: "En avant-vente",
  };
  return (
    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", map[status] ?? "bg-slate-100 text-slate-500")}>
      {labels[status] ?? status}
    </span>
  );
}

export default function VeillePage() {
  const [entries, setEntries] = useState<VeilleEntry[]>([]);
  const [sources, setSources] = useState<VeilleSource[]>([]);
  const [stats, setStats] = useState({ total: 0, new: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", url: "", feed_type: "rss", keywords: "" });
  const [addingSource, setAddingSource] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [feed, srcs, st] = await Promise.all([
        fetchVeilleFeed(100, filterStatus),
        fetchVeilleSources(),
        fetchVeilleStats(),
      ]);
      setEntries(feed);
      setSources(srcs);
      setStats(st);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function handleInitDemo() {
    await initVeilleDemoSources();
    await loadAll();
  }

  useEffect(() => { loadAll(); }, [filterStatus]);

  async function handleScan() {
    setScanning(true);
    try {
      await triggerVeilleScan();
      await loadAll();
    } catch { /* ignore */ } finally {
      setScanning(false);
    }
  }

  async function handlePatch(id: number, status: string) {
    await patchVeilleEntry(id, status);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    setStats(prev => ({
      ...prev,
      new: prev.new + (status === "new" ? 1 : -1),
    }));
  }

  async function handleAddSource() {
    if (!newSource.name || !newSource.url) return;
    setAddingSource(true);
    try {
      await addVeilleSource(newSource);
      setNewSource({ name: "", url: "", feed_type: "rss", keywords: "" });
      await loadAll();
    } catch { /* ignore */ } finally {
      setAddingSource(false);
    }
  }

  async function handleDeleteSource(id: number) {
    await deleteVeilleSource(id);
    setSources(prev => prev.filter(s => s.id !== id));
  }

  const filtered = entries.filter(e =>
    !searchQ || e.title.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.description.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "linear-gradient(160deg, #eef0f8 0%, #e8ecf5 50%, #edf0f8 100%)" }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 sticky top-0 z-10 flex items-center justify-between gap-4"
        style={{ background: "rgba(238,240,248,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-none flex items-center gap-2">
            <Rss className="w-4 h-4 text-orange-500" /> Veille Appels d&apos;Offres
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {stats.total} AO détectés ·{" "}
            <span className="font-semibold text-blue-600">{stats.new} nouveaux</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSources(!showSources)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors",
              showSources
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}>
            <Settings size={12} /> Sources ({sources.length})
          </button>
          <button onClick={handleScan} disabled={scanning}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
            <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scan en cours..." : "Scanner maintenant"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-6 py-6 space-y-5">

          {/* Sources panel */}
          {showSources && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">Sources configurées</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {sources.length === 0 && (
                  <div className="px-5 py-6 text-center">
                    <p className="text-sm text-slate-400 mb-3">Aucune source configurée</p>
                    <button onClick={handleInitDemo}
                      className="text-xs px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
                      Ajouter les sources démo (DGMP, BOAD)
                    </button>
                  </div>
                )}
                {sources.map(src => (
                  <div key={src.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <Rss size={13} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{src.name}</p>
                      <p className="text-xs text-slate-400 truncate">{src.url}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{src.feed_type}</span>
                    {src.last_scan && (
                      <span className="text-[10px] text-slate-400 hidden sm:block">
                        Scanné {new Date(src.last_scan).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                    <button onClick={() => handleDeleteSource(src.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Add source form */}
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ajouter une source</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newSource.name}
                    onChange={e => setNewSource(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nom de la source"
                    className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <select
                    value={newSource.feed_type}
                    onChange={e => setNewSource(p => ({ ...p, feed_type: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
                  >
                    <option value="rss">RSS / Atom</option>
                    <option value="html">Page HTML</option>
                  </select>
                </div>
                <input
                  value={newSource.url}
                  onChange={e => setNewSource(p => ({ ...p, url: e.target.value }))}
                  placeholder="URL du flux ou de la page"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <input
                  value={newSource.keywords}
                  onChange={e => setNewSource(p => ({ ...p, keywords: e.target.value }))}
                  placeholder="Mots-clés filtrants (séparés par virgule): informatique,réseau,logiciel"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  onClick={handleAddSource}
                  disabled={addingSource || !newSource.name || !newSource.url}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                >
                  <Plus size={12} /> {addingSource ? "Ajout..." : "Ajouter la source"}
                </button>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Rechercher dans les opportunités..."
                className="w-full text-sm pl-8 pr-3 py-2 rounded-xl border border-white/80 bg-white/80 backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            {(["", "new", "read", "in_presales"] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn(
                  "text-xs px-3 py-2 rounded-xl font-medium transition-colors whitespace-nowrap",
                  filterStatus === s
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-white/80 text-slate-600 hover:bg-white border border-white/80"
                )}>
                {s === "" ? "Tous" : s === "new" ? "Nouveaux" : s === "read" ? "Lus" : "En avant-vente"}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.9)" }}>
              <Rss size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="font-semibold text-slate-600 mb-1">Aucune opportunité détectée</p>
              <p className="text-sm text-slate-400 mb-4">
                {sources.length === 0
                  ? "Ajoutez des sources RSS/HTML pour commencer la veille."
                  : "Cliquez sur «Scanner maintenant» pour chercher de nouveaux AOs."}
              </p>
              {sources.length === 0 && (
                <button onClick={handleInitDemo} className="text-xs px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">
                  Démarrer avec les sources démo
                </button>
              )}
            </div>
          )}

          {/* Feed */}
          {filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map(entry => (
                <div
                  key={entry.id}
                  className={cn("rounded-2xl p-4 transition-all", entry.status === "new" ? "ring-1 ring-blue-200" : "")}
                  style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", entry.status === "new" ? "bg-blue-500" : "bg-slate-300")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{entry.title}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <ScoreBadge score={entry.relevance_score} />
                          <StatusBadge status={entry.status} />
                        </div>
                      </div>
                      {entry.description && entry.description !== entry.title && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2">{entry.description}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        {entry.estimated_budget && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Zap size={10} className="text-amber-400" /> {entry.estimated_budget}
                          </span>
                        )}
                        {entry.deadline && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Calendar size={10} className="text-red-400" /> {entry.deadline}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={10} /> {new Date(entry.detected_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                    {entry.url && (
                      <a href={entry.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Voir l&apos;AO <ArrowUpRight size={11} />
                      </a>
                    )}
                    {entry.status === "new" && (
                      <button onClick={() => handlePatch(entry.id, "read")}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 ml-auto">
                        <Eye size={11} /> Marquer lu
                      </button>
                    )}
                    {entry.status !== "in_presales" && entry.status !== "archived" && (
                      <button onClick={() => handlePatch(entry.id, "in_presales")}
                        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium ml-auto">
                        <Zap size={11} /> Avant-vente
                      </button>
                    )}
                    {entry.status !== "archived" && (
                      <button onClick={() => handlePatch(entry.id, "archived")}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                        <Archive size={11} /> Archiver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
