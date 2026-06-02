"use client";
import { useState, useEffect, useRef, useCallback, DragEvent } from "react";
import {
  FolderOpen, Folder, FileText, Upload, Trash2, Plus, RefreshCw,
  ChevronRight, ChevronDown, File, Search, X, AlertCircle, CheckCircle2,
  FilePlus, AlertTriangle, ShieldAlert, RotateCcw,
  Layers, Tag, Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchGEDTree, fetchGEDFiles, fetchGEDStatus, uploadGEDFile,
  deleteGEDFile, createGEDFolder, reindexGED, deleteGEDFolder,
  fetchGEDQuarantine, retryGEDQuarantine, deleteGEDQuarantine,
  fetchGEDDocumentChunks, fetchGEDIndexHealth, searchGEDDebug, searchGEDProd,
  type GEDCategory, type GEDFile, type GEDFolder, type GEDStatus, type GEDQuarantineEntry,
  type GEDDocumentChunks, type GEDChunk, type GEDIndexHealth, type GEDSearchHit, type GEDProdHit,
} from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const DOC_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  cv:              { label: "CV",           color: "bg-blue-50 text-blue-600 border-blue-100" },
  offre_technique: { label: "Offre",        color: "bg-violet-50 text-violet-600 border-violet-100" },
  abe:             { label: "ABE",          color: "bg-orange-50 text-orange-600 border-orange-100" },
  pv_recette:      { label: "PV Recette",   color: "bg-teal-50 text-teal-600 border-teal-100" },
  procedure:       { label: "Procédure",    color: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  fiche_technique: { label: "Fiche Tech",   color: "bg-pink-50 text-pink-600 border-pink-100" },
  compte_rendu:    { label: "CR",           color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  unknown:         { label: "Inconnu",      color: "bg-slate-50 text-slate-500 border-slate-100" },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "cvs": () => <span>👤</span>,
  "offres-techniques": () => <span>📋</span>,
  "abe": () => <span>🏛️</span>,
  "pv-recette": () => <span>✅</span>,
  "procedures": () => <span>📖</span>,
  "fiches-techniques": () => <span>🔧</span>,
  "comptes-rendus": () => <span>📝</span>,
};

const EXT_COLORS: Record<string, string> = {
  pdf: "text-red-400", docx: "text-blue-500", doc: "text-blue-400", txt: "text-slate-400",
};

interface FlatPath { path: string; label: string; depth: number }

function flattenPaths(categories: GEDCategory[]): FlatPath[] {
  const result: FlatPath[] = [];
  function walk(folder: GEDFolder, depth: number) {
    result.push({ path: folder.path, label: folder.name, depth });
    folder.subfolders.forEach(sf => walk(sf, depth + 1));
  }
  categories.forEach(cat => {
    result.push({ path: cat.name, label: cat.label, depth: 0 });
    cat.subfolders.forEach(sf => walk(sf, 1));
  });
  return result;
}

// ── FolderNode ────────────────────────────────────────────────────────────────

interface FolderNodeProps {
  path: string; name: string; label?: string;
  fileCount: number; subfolders: GEDFolder[]; selected: string;
  onSelect: (path: string) => void; onDelete?: (path: string, name: string) => void;
  depth?: number;
}

function FolderNode({ path, name, label, fileCount, subfolders, selected, onSelect, onDelete, depth = 0 }: FolderNodeProps) {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = selected === path;
  const hasChildren = subfolders.length > 0;
  const IconComp = CATEGORY_ICONS[name];

  return (
    <div>
      <div className="group/folder relative">
        <button
          onClick={() => { onSelect(path); if (hasChildren) setOpen((o) => !o); }}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[13px] transition-all",
            isSelected
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="w-3.5 shrink-0 flex items-center justify-center">
            {hasChildren
              ? (open
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />)
              : null
            }
          </span>
          {depth === 0 && IconComp
            ? <span className="text-sm leading-none shrink-0"><IconComp /></span>
            : isSelected
            ? <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            : <Folder className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          }
          <span className={cn("flex-1 truncate", depth === 0 ? "font-medium" : "font-normal")}>{label ?? name}</span>
          {fileCount > 0 && (
            <span className={cn(
              "text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0",
              isSelected ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
            )}>
              {fileCount}
            </span>
          )}
        </button>
        {onDelete && depth > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(path, label ?? name); }}
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover/folder:opacity-100 transition-opacity",
              isSelected ? "text-blue-200 hover:text-white" : "text-slate-400 hover:text-red-500 hover:bg-red-50"
            )}
            title="Supprimer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {subfolders.map((sf) => (
            <FolderNode
              key={sf.path} path={sf.path} name={sf.name}
              fileCount={sf.file_count} subfolders={sf.subfolders as never[]}
              selected={selected} onSelect={onSelect} onDelete={onDelete} depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── FileCard ──────────────────────────────────────────────────────────────────

function FileCard({ file, onDelete, onInspect }: { file: GEDFile; onDelete: (id: string) => void; onInspect: (file: GEDFile) => void }) {
  const [confirming, setConfirming] = useState(false);
  const badge = DOC_TYPE_LABELS[file.doc_type] ?? DOC_TYPE_LABELS.unknown;
  const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
  const inspectable = file.is_indexed && !!file.doc_id;

  return (
    <div
      onClick={() => inspectable && onInspect(file)}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group hover:-translate-y-px",
        inspectable && "cursor-pointer hover:ring-2 hover:ring-blue-200",
      )}
      style={GLASS}
    >
      <div className={cn("shrink-0", EXT_COLORS[ext] ?? "text-slate-400")}>
        <FileText className="w-7 h-7" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{file.filename}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-md border", badge.color)}>
            {badge.label}
          </span>
          <span className="text-xs text-slate-400">{fmtSize(file.size_bytes)}</span>
          <span className="text-xs text-slate-200">·</span>
          <span className="text-xs text-slate-400">{fmtDate(file.last_indexed)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {file.is_indexed ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Indexé</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">En attente</span>
          </span>
        )}
        {file.doc_id && (
          confirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(file.doc_id!); setConfirming(false); }}
                className="text-xs text-red-600 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                Confirmer
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                className="text-xs text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function DeleteFolderModal({ folderPath, folderName, onClose, onDeleted }: {
  folderPath: string; folderName: string; onClose: () => void; onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    try {
      await deleteGEDFolder(folderPath);
      onDeleted();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Supprimer le dossier</h3>
            <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
              Supprimera <strong className="text-slate-800">{folderName}</strong> et tous ses fichiers de manière irréversible.
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-4 font-mono border border-slate-100">
          {folderPath}
        </p>
        {error && (
          <p className="text-xs text-red-500 mb-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {loading ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateFolderModal({ categories, initialParent, onClose, onCreated }: {
  categories: GEDCategory[]; initialParent: string; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [parentPath, setParentPath] = useState(initialParent);
  const [isRoot, setIsRoot] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const allPaths = flattenPaths(categories);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const trimmedName = name.trim().replace(/[/\\]/g, "-");
  const fullPath = isRoot ? trimmedName : `${parentPath}/${trimmedName}`;

  const submit = async () => {
    if (!trimmedName) { setError("Nom du dossier requis"); return; }
    setLoading(true);
    try {
      await createGEDFolder(fullPath);
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Nouveau dossier</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="flex items-center gap-3 mb-4 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <input
            type="checkbox" checked={isRoot} onChange={e => setIsRoot(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 accent-blue-600"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Catégorie racine</span>
            <p className="text-xs text-slate-400 mt-0.5">Apparaîtra dans la liste principale</p>
          </div>
        </label>

        {!isRoot && allPaths.length > 0 && (
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Dossier parent</label>
            <select
              value={parentPath} onChange={e => setParentPath(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {allPaths.map(p => (
                <option key={p.path} value={p.path}>
                  {"  ".repeat(p.depth)}{p.depth > 0 ? "└ " : ""}{p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-2">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nom du dossier</label>
          <input
            ref={inputRef} value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="ex. 2026, DISTRIMAT, Q1…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {trimmedName && (
          <p className="text-xs text-slate-400 mb-2">
            Chemin : <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">{fullPath}</code>
          </p>
        )}

        {error && (
          <p className="text-xs text-red-500 mt-1 mb-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />{error}
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={submit} disabled={loading}
            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            {loading ? "Création…" : "Créer le dossier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QuarantinePanel ───────────────────────────────────────────────────────────

function QuarantineRow({ e, retentionDays, onRetry, onDelete }: {
  e: GEDQuarantineEntry; retentionDays: number;
  onRetry: (e: GEDQuarantineEntry) => Promise<void>;
  onDelete: (e: GEDQuarantineEntry) => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Jours restants avant auto-suppression (depuis la dernière tentative)
  const daysLeft = retentionDays > 0
    ? Math.max(0, retentionDays - Math.floor((Date.now() - new Date(e.quarantined_at).getTime()) / 86400000))
    : null;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{e.filename}</p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{e.reason}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
          <span>{new Date(e.quarantined_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
          {e.retry_count > 0 && <span>{e.retry_count} tentative{e.retry_count > 1 ? "s" : ""}</span>}
          {e.text_length > 0 && <span>{e.text_length} chars extraits</span>}
          {e.file_size_bytes > 0 && <span>{(e.file_size_bytes / 1024).toFixed(0)} Ko</span>}
          {daysLeft !== null && (
            <span className={cn(daysLeft <= 1 ? "text-red-500 font-medium" : "text-slate-400")}>
              suppr. auto dans {daysLeft} j
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={async () => { setRetrying(true); try { await onRetry(e); } finally { setRetrying(false); } }}
          disabled={retrying || deleting}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors font-medium disabled:opacity-50"
        >
          {retrying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
          Réessayer
        </button>
        {confirming ? (
          <>
            <button
              onClick={async () => { setDeleting(true); try { await onDelete(e); } finally { setDeleting(false); setConfirming(false); } }}
              disabled={deleting}
              className="text-xs px-2 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              {deleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Confirmer"}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              Annuler
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="p-1.5 rounded-lg text-amber-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Supprimer le fichier (non indexable)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function QuarantinePanel({ entries, retentionDays, onRetry, onDelete }: {
  entries: GEDQuarantineEntry[]; retentionDays: number;
  onRetry: (e: GEDQuarantineEntry) => Promise<void>;
  onDelete: (e: GEDQuarantineEntry) => Promise<void>;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200" style={{ background: "rgba(255,251,235,0.9)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold text-amber-800">
          {entries.length} fichier{entries.length > 1 ? "s" : ""} en quarantaine
        </span>
        <span className="text-xs text-amber-500 ml-1">— rejetés par le validateur qualité</span>
        {retentionDays > 0 && (
          <span className="text-[11px] text-amber-500 ml-auto">auto-suppression après {retentionDays} j d&apos;inactivité</span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-amber-100">
        {entries.map((e) => (
          <QuarantineRow key={e.id} e={e} retentionDays={retentionDays} onRetry={onRetry} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ── IndexHealthPanel ──────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col px-3 py-2 rounded-xl bg-white/70 border border-slate-100">
      <span className="text-base font-bold text-slate-800 tabular-nums leading-none">{value}</span>
      <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function IndexHealthPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<GEDIndexHealth | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGEDIndexHealth()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!data) return null;
  const anomalies = data.anomalies.in_registry_without_chunks.length + data.anomalies.in_vector_without_registry.length;

  return (
    <div className="rounded-2xl overflow-hidden" style={GLASS}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/40 transition-colors">
        <Boxes className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-700">Santé de l&apos;index</span>
        <span className="text-xs text-slate-400">{data.total_chunks} chunks · {data.total_documents} documents</span>
        {anomalies > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
            <AlertTriangle className="w-3 h-3" /> {anomalies} anomalie{anomalies > 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <Stat label="Chunks" value={data.total_chunks} />
            <Stat label="Documents" value={data.total_documents} />
            <Stat label="Chunks/doc" value={data.avg_chunks_per_doc} />
            <Stat label="Mots/chunk" value={data.avg_words_per_chunk} />
            <Stat label="Parents" value={data.parent_chunks} />
            <Stat label="Enfants" value={data.child_chunks} />
          </div>

          {/* Répartition par type */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Par type de document</p>
            {Object.entries(data.by_doc_type).map(([type, v]) => {
              const badge = DOC_TYPE_LABELS[type] ?? DOC_TYPE_LABELS.unknown;
              return (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className={cn("font-semibold px-1.5 py-0.5 rounded-md border w-20 text-center shrink-0", badge.color)}>{badge.label}</span>
                  <span className="text-slate-500">{v.documents} doc · {v.chunks} chunks</span>
                </div>
              );
            })}
          </div>

          {/* Anomalies */}
          {anomalies > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Anomalies</p>
              {data.anomalies.in_registry_without_chunks.map((o) => (
                <p key={o.doc_id} className="text-xs text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {o.filename} — indexé au registre mais 0 chunk vectoriel
                </p>
              ))}
              {data.anomalies.in_vector_without_registry.map((id) => (
                <p key={id} className="text-xs text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> doc_id {id.slice(0, 8)}… — chunks vectoriels sans entrée registre
                </p>
              ))}
            </div>
          )}

          {/* Documents avec le moins de chunks (détection découpage anormal) */}
          {data.per_document.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Découpage par document (croissant)</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {data.per_document.slice(0, 8).map((d) => (
                  <div key={d.doc_id} className="flex items-center gap-2 px-3 py-1.5 text-xs even:bg-slate-50/50">
                    <span className="text-slate-700 truncate flex-1">{d.filename}</span>
                    <span className="text-slate-400 shrink-0 tabular-nums">{d.chunk_count} chunk{d.chunk_count > 1 ? "s" : ""} · {d.avg_words} mots/ch.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ChunkInspectorDrawer ──────────────────────────────────────────────────────

function fmtFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "null") return "—";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ChunkRow({ chunk }: { chunk: GEDChunk }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        <span className="text-xs font-mono text-slate-400 shrink-0">#{chunk.chunk_index}</span>
        {chunk.is_parent ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100 shrink-0">parent</span>
        ) : chunk.parent_chunk_id ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100 shrink-0">enfant</span>
        ) : null}
        <span className="text-xs text-slate-500 truncate flex-1">
          {chunk.content.slice(0, 90)}
        </span>
        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">{chunk.word_count} mots</span>
      </button>
      {open && (
        <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words px-3 py-2.5 border-t border-slate-100 bg-slate-50/60 max-h-72 overflow-y-auto font-mono leading-relaxed">
          {chunk.content}
        </pre>
      )}
    </div>
  );
}

function ChunkInspectorDrawer({ file, onClose }: { file: GEDFile; onClose: () => void }) {
  const [tab, setTab] = useState<"chunks" | "meta">("chunks");
  const [data, setData] = useState<GEDDocumentChunks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchGEDDocumentChunks(file.doc_id!)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de chargement"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [file.doc_id]);

  const badge = DOC_TYPE_LABELS[file.doc_type] ?? DOC_TYPE_LABELS.unknown;
  const metaEntries = data ? Object.entries(data.extracted_fields) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{file.filename}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-md border", badge.color)}>{badge.label}</span>
                {data && <span className="text-xs text-slate-400">{data.chunk_count} chunk{data.chunk_count > 1 ? "s" : ""}</span>}
                {data?.contains_pii && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">PII</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setTab("chunks")}
              className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                tab === "chunks" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100")}
            >
              <Layers className="w-3.5 h-3.5" /> Découpage
            </button>
            <button
              onClick={() => setTab("meta")}
              className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                tab === "meta" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100")}
            >
              <Tag className="w-3.5 h-3.5" /> Métadonnées
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> <span className="text-sm">Chargement…</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          ) : tab === "chunks" ? (
            <div className="flex flex-col gap-2">
              {data!.chunks.map((c) => <ChunkRow key={c.chunk_id} chunk={c} />)}
            </div>
          ) : (
            metaEntries.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-10">Aucune métadonnée extraite</p>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {metaEntries.map(([key, value]) => (
                  <div key={key} className="flex gap-3 px-4 py-2.5 even:bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-500 w-36 shrink-0 capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs text-slate-700 break-words">{fmtFieldValue(value)}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── SearchPlaygroundDrawer ────────────────────────────────────────────────────

function ScoreCell({ label, rank, score, color }: { label: string; rank: number | null; score: number | null; color: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1 rounded-lg border border-slate-100 bg-white/70 min-w-[64px]">
      <span className="text-[9px] uppercase tracking-wide text-slate-400">{label}</span>
      {rank === null ? (
        <span className="text-xs text-slate-300">—</span>
      ) : (
        <>
          <span className={cn("text-xs font-bold tabular-nums", color)}>#{rank}</span>
          <span className="text-[10px] text-slate-400 tabular-nums">{score}</span>
        </>
      )}
    </div>
  );
}

function HitRow({ hit, rrfRank }: { hit: GEDSearchHit; rrfRank: number }) {
  const badge = DOC_TYPE_LABELS[hit.doc_type ?? "unknown"] ?? DOC_TYPE_LABELS.unknown;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0", badge.color)}>{badge.label}</span>
        <span className="text-xs font-medium text-slate-700 truncate flex-1">{hit.filename ?? hit.chunk_id}</span>
        <span className="text-[10px] text-slate-400 shrink-0">{hit.word_count} mots</span>
      </div>
      <div className="flex items-center gap-2">
        <ScoreCell label="RRF" rank={rrfRank} score={hit.rrf_score} color="text-blue-600" />
        <ScoreCell label="Dense" rank={hit.dense_rank} score={hit.dense_score} color="text-violet-600" />
        <ScoreCell label="BM25" rank={hit.sparse_rank} score={hit.sparse_score} color="text-emerald-600" />
        <p className="text-[11px] text-slate-500 leading-snug line-clamp-3 flex-1">{hit.excerpt}</p>
      </div>
    </div>
  );
}

function ProdHitRow({ hit, rank, scoreLabel }: { hit: GEDProdHit; rank: number; scoreLabel: string }) {
  const [open, setOpen] = useState(false);
  const badge = DOC_TYPE_LABELS[hit.doc_type ?? "unknown"] ?? DOC_TYPE_LABELS.unknown;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors">
        <span className="text-xs font-bold text-blue-600 tabular-nums shrink-0">#{rank}</span>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0", badge.color)}>{badge.label}</span>
        <span className="text-xs font-medium text-slate-700 truncate flex-1">{hit.filename}</span>
        {hit.expanded_from_parent && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100 shrink-0"
            title="Contexte remonté au chunk parent (small-to-big)"
          >
            via parent
          </span>
        )}
        <span className="text-[10px] text-slate-500 shrink-0 tabular-nums" title={`Score ${scoreLabel}`}>
          {scoreLabel} {hit.relevance_score.toFixed(scoreLabel === "rerank" ? 2 : 4)}
        </span>
        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">{hit.context_words} mots · {hit.context_tokens} tok</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-2.5 flex flex-col gap-2 bg-slate-50/40">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Extrait (citation)</p>
            <p className="text-[11px] text-slate-600 leading-snug">{hit.excerpt}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
              Contexte injecté au LLM — {hit.context_chars} c.{hit.expanded_from_parent ? " (parent)" : ""}
            </p>
            <pre className="text-[11px] text-slate-700 whitespace-pre-wrap break-words max-h-56 overflow-y-auto font-mono leading-relaxed">
              {hit.context_preview}{hit.context_chars > hit.context_preview.length ? " …" : ""}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchPlaygroundDrawer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"prod" | "debug">("prod");
  const [query, setQuery] = useState("");
  const [docType, setDocType] = useState("");
  const [topK, setTopK] = useState(10);
  const [rerank, setRerank] = useState(false);
  const [hits, setHits] = useState<GEDSearchHit[]>([]);
  const [prodHits, setProdHits] = useState<GEDProdHit[]>([]);
  const [prodMeta, setProdMeta] = useState<{ scoreLabel: string; rerankApplied: boolean; rerankerAvailable: boolean } | null>(null);
  const [meta, setMeta] = useState<{ dense: number; sparse: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const switchMode = (m: "prod" | "debug") => {
    setMode(m);
    setSearched(false);
    setHits([]);
    setProdHits([]);
    setMeta(null);
    setProdMeta(null);
    setError("");
  };

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "debug") {
        const res = await searchGEDDebug(query, topK, docType || undefined);
        setHits(res.results);
        setMeta({ dense: res.dense_hits, sparse: res.sparse_hits });
      } else {
        const res = await searchGEDProd(query, topK, docType || undefined, rerank);
        setProdHits(res.results);
        setProdMeta({ scoreLabel: res.score_label, rerankApplied: res.rerank_applied, rerankerAvailable: res.reranker_available });
        setMeta(null);
      }
      setSearched(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900">Playground de recherche</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bascule de mode */}
          <div className="flex gap-1 mb-3 p-0.5 rounded-xl bg-slate-100 w-fit">
            <button
              onClick={() => switchMode("prod")}
              className={cn("text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                mode === "prod" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Production
            </button>
            <button
              onClick={() => switchMode("debug")}
              className={cn("text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                mode === "debug" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Diagnostic
            </button>
            <span className="text-[11px] text-slate-400 self-center pl-2">
              {mode === "prod"
                ? "ce que le chat reçoit : fusion chunk + expansion parent + dédup"
                : "fusion brute : scores dense / BM25 / RRF par chunk"}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              value={query} autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Saisir une requête de test…"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={run} disabled={loading || !query.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Chercher
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <select
              value={docType} onChange={(e) => setDocType(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Tous les types</option>
              {Object.entries(DOC_TYPE_LABELS).filter(([k]) => k !== "unknown").map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              top_k
              <input
                type="number" min={1} max={50} value={topK}
                onChange={(e) => setTopK(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            {mode === "prod" && (
              <label className="text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox" checked={rerank} onChange={(e) => setRerank(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-600"
                />
                Reranker
              </label>
            )}
            {meta && (
              <span className="text-xs text-slate-400 ml-auto">{meta.dense} dense · {meta.sparse} BM25</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> <span className="text-sm">Recherche…</span>
            </div>
          ) : !searched ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <Search className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">
                {mode === "prod"
                  ? "Lancez une requête pour voir les blocs envoyés au LLM"
                  : "Lancez une requête pour voir les chunks remontés"}
              </p>
            </div>
          ) : mode === "prod" ? (
            prodHits.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-10">Aucun résultat</p>
            ) : (
              <>
                {rerank && prodMeta && !prodMeta.rerankerAvailable && (
                  <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Reranker non disponible côté serveur — résultats classés par RRF.
                  </div>
                )}
                {prodMeta?.rerankApplied && (
                  <div className="text-[11px] text-violet-600 font-medium px-1">
                    Re-classement cross-encoder appliqué (scores « rerank »).
                  </div>
                )}
                {prodHits.map((h, i) => (
                  <ProdHitRow key={h.chunk_id} hit={h} rank={i + 1} scoreLabel={prodMeta?.scoreLabel ?? "RRF"} />
                ))}
              </>
            )
          ) : (
            hits.length === 0
              ? <p className="text-sm text-slate-400 italic text-center py-10">Aucun résultat</p>
              : hits.map((h, i) => <HitRow key={h.chunk_id} hit={h} rrfRank={i + 1} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_BG = "linear-gradient(160deg, #eef0f8 0%, #e8ecf5 50%, #edf0f8 100%)";
const GLASS = {
  background: "rgba(255,255,255,0.85)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.9)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
} as React.CSSProperties;
const HEADER_BG = {
  background: "rgba(238,240,248,0.85)",
  backdropFilter: "blur(20px)",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
} as React.CSSProperties;

export default function GEDPage() {
  const [categories, setCategories] = useState<GEDCategory[]>([]);
  const [files, setFiles] = useState<GEDFile[]>([]);
  const [status, setStatus] = useState<GEDStatus | null>(null);
  const [quarantine, setQuarantine] = useState<GEDQuarantineEntry[]>([]);
  const [quarantineRetention, setQuarantineRetention] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState("cvs");
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<{ path: string; name: string } | null>(null);
  const [inspectingFile, setInspectingFile] = useState<GEDFile | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [healthKey, setHealthKey] = useState(0);
  const [forceConfirm, setForceConfirm] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTree = useCallback(async () => {
    try {
      const [treeData, statusData, quarantineData] = await Promise.all([
        fetchGEDTree(),
        fetchGEDStatus(),
        fetchGEDQuarantine().catch(() => ({ quarantine: [], total: 0, retention_days: 0 })),
      ]);
      setCategories(treeData.categories);
      setStatus(statusData);
      setQuarantine(quarantineData.quarantine);
      setQuarantineRetention(quarantineData.retention_days ?? 0);
      setHealthKey((k) => k + 1);
    } catch { /* backend may be offline */ }
  }, []);

  const loadFiles = useCallback(async (folder: string, q: string) => {
    setLoadingFiles(true);
    try {
      const data = await fetchGEDFiles(folder, q || undefined);
      setFiles(data.files);
    } catch {
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => { loadFiles(selectedFolder, search); }, [selectedFolder, search, loadFiles]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleFolderSelect = (path: string) => {
    setSelectedFolder(path);
    setSearch("");
  };

  const startPolling = useCallback((folder: string, q: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks++;
      setRefreshing(true);
      await Promise.all([loadFiles(folder, q), loadTree()]);
      setRefreshing(false);
      if (ticks >= 10) { clearInterval(pollRef.current!); pollRef.current = null; }
    }, 3000);
  }, [loadFiles, loadTree]);

  const doUpload = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    setUploading(true);
    setUploadMsg(null);
    const results = await Promise.allSettled(arr.map((f) => uploadGEDFile(f, selectedFolder)));
    const failed = results.filter((r) => r.status === "rejected");
    const ok = results.filter((r) => r.status === "fulfilled").length;
    if (failed.length === 0) {
      setUploadMsg({ type: "ok", text: `${ok} fichier${ok > 1 ? "s" : ""} envoyé${ok > 1 ? "s" : ""}, indexation en cours…` });
      startPolling(selectedFolder, search);
    } else {
      const firstErr = failed[0] as PromiseRejectedResult;
      setUploadMsg({ type: "err", text: `${failed.length} erreur(s) — ${firstErr.reason?.message ?? "inconnu"}` });
    }
    setUploading(false);
    setTimeout(() => setUploadMsg(null), 6000);
    await loadTree();
    await loadFiles(selectedFolder, search);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files);
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteGEDFile(docId);
      setFiles((prev) => prev.filter((f) => f.doc_id !== docId));
      await loadTree();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur suppression");
    }
  };

  const handleDeleteFolder = async () => {
    if (!deletingFolder) return;
    await loadTree();
    if (selectedFolder === deletingFolder.path || selectedFolder.startsWith(deletingFolder.path + "/")) {
      setSelectedFolder("cvs");
    }
    setDeletingFolder(null);
  };

  const handleRetryQuarantine = async (entry: GEDQuarantineEntry) => {
    try {
      await retryGEDQuarantine(entry.file_path);
      setUploadMsg({ type: "ok", text: `Réindexation lancée pour ${entry.filename}…` });
      startPolling(selectedFolder, search);
    } catch (e: unknown) {
      setUploadMsg({ type: "err", text: e instanceof Error ? e.message : "Erreur réessai" });
    }
    setTimeout(() => setUploadMsg(null), 5000);
  };

  const handleDeleteQuarantine = async (entry: GEDQuarantineEntry) => {
    try {
      await deleteGEDQuarantine(entry.file_path);
      setQuarantine((prev) => prev.filter((q) => q.id !== entry.id));
      setUploadMsg({ type: "ok", text: `${entry.filename} supprimé` });
      await loadTree();
      await loadFiles(selectedFolder, search);
    } catch (e: unknown) {
      setUploadMsg({ type: "err", text: e instanceof Error ? e.message : "Erreur suppression" });
    }
    setTimeout(() => setUploadMsg(null), 5000);
  };

  const selectedLabel = categories.find((c) => selectedFolder.startsWith(c.name))?.label ?? selectedFolder;
  const filteredFiles = files.filter((f) => !search || f.filename.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full" style={{ background: PAGE_BG }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10" style={HEADER_BG}>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-none">Base documentaire</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            {status
              ? `${status.total_indexed} indexé${status.total_indexed !== 1 ? "s" : ""} · ${status.total_on_disk} sur disque · ${fmtDate(status.last_indexed_at)}`
              : "Chargement…"}
            {quarantine.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold">
                <ShieldAlert className="w-3 h-3" />
                {quarantine.length} en quarantaine
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
            title="Tester le retrieval (dense / BM25 / RRF)"
          >
            <Search className="w-3.5 h-3.5" />
            Recherche
          </button>
          <button
            onClick={async () => {
              try {
                const res = await reindexGED();
                setUploadMsg({ type: "ok", text: res.message });
                if (res.queued > 0) startPolling(selectedFolder, search);
              } catch (e: unknown) {
                setUploadMsg({ type: "err", text: e instanceof Error ? e.message : "Erreur réindexation" });
              }
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
            title="Réindexer les fichiers en attente"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Indexation…" : "Réindexer"}
          </button>
          {forceConfirm ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 bg-amber-50">
              <span className="text-[11px] text-amber-700 font-medium">Re-découper TOUT ?</span>
              <button
                onClick={async () => {
                  setForceConfirm(false);
                  try {
                    const res = await reindexGED(true);
                    setUploadMsg({ type: "ok", text: res.message });
                    if (res.queued > 0) startPolling(selectedFolder, search);
                  } catch (e: unknown) {
                    setUploadMsg({ type: "err", text: e instanceof Error ? e.message : "Erreur réindexation" });
                  }
                }}
                className="text-[11px] font-semibold text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-100"
              >
                Confirmer
              </button>
              <button onClick={() => setForceConfirm(false)} className="text-[11px] text-slate-500 px-1.5 py-0.5 rounded hover:bg-slate-100">
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setForceConfirm(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors font-medium"
              title="Ré-indexer TOUS les documents (re-découpage complet, ex. après changement de chunking). Consomme le LLM."
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tout ré-indexer
            </button>
          )}
          <button
            onClick={() => { loadTree(); loadFiles(selectedFolder, search); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition-all font-medium hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)" }}
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Envoi…" : "Importer"}
          </button>
          <input
            ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" multiple className="hidden"
            onChange={(e) => e.target.files && doUpload(e.target.files)}
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Folder tree */}
        <aside className="w-56 shrink-0 overflow-y-auto flex flex-col" style={{ background: "rgba(238,240,248,0.6)", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="p-3 flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 pb-1.5">
              Catégories
            </p>
            {categories.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-2 italic">Backend hors ligne ou GED vide</p>
            ) : (
              categories.map((cat) => (
                <FolderNode
                  key={cat.name} path={cat.name} name={cat.name} label={cat.label}
                  fileCount={cat.file_count} subfolders={cat.subfolders}
                  selected={selectedFolder} onSelect={handleFolderSelect}
                  onDelete={(path, name) => setDeletingFolder({ path, name })}
                  depth={0}
                />
              ))
            )}
          </div>
          <div className="mt-auto p-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button
              onClick={() => setShowFolderModal(true)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-500 hover:bg-white/60 hover:text-slate-700 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau dossier
            </button>
          </div>
        </aside>

        {/* File list */}
        <main className="flex-1 min-w-0 overflow-y-auto flex flex-col" style={{ background: "rgba(238,240,248,0.4)" }}>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 sticky top-0 z-10" style={{ background: "rgba(238,240,248,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div className="flex items-center gap-1.5 text-sm text-slate-700 font-medium">
              <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
              <span>{selectedLabel}</span>
              {selectedFolder.includes("/") && (
                <span className="text-slate-400 font-normal">
                  / {selectedFolder.split("/").slice(1).join(" / ")}
                </span>
              )}
            </div>
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 focus:bg-white transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-5 flex flex-col gap-4">
            {/* Toast */}
            {uploadMsg && (
              <div className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl text-sm border font-medium",
                uploadMsg.type === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-red-50 border-red-200 text-red-700"
              )}>
                {uploadMsg.type === "ok"
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                  : <AlertCircle className="w-4 h-4 shrink-0" />}
                {uploadMsg.text}
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl px-6 py-7 flex flex-col items-center gap-2 cursor-pointer transition-all select-none",
                dragging
                  ? "border-violet-400"
                  : "border-white/60 hover:border-violet-300"
              )}
              style={dragging
                ? { background: "rgba(139,92,246,0.06)" }
                : { background: "rgba(255,255,255,0.5)", backdropFilter: "blur(8px)" }
              }
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                dragging ? "bg-blue-100" : "bg-slate-100"
              )}>
                {dragging
                  ? <FilePlus className="w-5 h-5 text-blue-600" />
                  : <Upload className="w-5 h-5 text-slate-400" />}
              </div>
              <p className="text-sm font-medium text-slate-700">
                {dragging ? "Déposez vos fichiers ici" : "Glissez des fichiers ou cliquez pour importer"}
              </p>
              <p className="text-xs text-slate-400">
                PDF, DOCX, DOC, TXT · Destination :{" "}
                <strong className="text-slate-600">{selectedLabel}</strong>
              </p>
            </div>

            {/* Index health panel */}
            <IndexHealthPanel refreshKey={healthKey} />

            {/* Quarantine panel */}
            <QuarantinePanel entries={quarantine} retentionDays={quarantineRetention} onRetry={handleRetryQuarantine} onDelete={handleDeleteQuarantine} />

            {/* File list */}
            {loadingFiles ? (
              <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Chargement…</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <File className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">Aucun document</p>
                <p className="text-xs text-slate-400 mt-1">Importez vos premiers fichiers dans cette catégorie</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400 font-medium">
                  {filteredFiles.length} fichier{filteredFiles.length !== 1 ? "s" : ""}
                </p>
                {filteredFiles.map((f) => (
                  <FileCard key={f.doc_id ?? f.file_path} file={f} onDelete={handleDelete} onInspect={setInspectingFile} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {showFolderModal && (
        <CreateFolderModal
          categories={categories} initialParent={selectedFolder}
          onClose={() => setShowFolderModal(false)}
          onCreated={() => { loadTree(); loadFiles(selectedFolder, search); }}
        />
      )}
      {deletingFolder && (
        <DeleteFolderModal
          folderPath={deletingFolder.path} folderName={deletingFolder.name}
          onClose={() => setDeletingFolder(null)} onDeleted={handleDeleteFolder}
        />
      )}
      {inspectingFile && (
        <ChunkInspectorDrawer file={inspectingFile} onClose={() => setInspectingFile(null)} />
      )}
      {showSearch && (
        <SearchPlaygroundDrawer onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
