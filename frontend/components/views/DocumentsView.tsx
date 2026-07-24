"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { fmtBytes } from "@/lib/format";
import {
  createFolder,
  deleteFile,
  deleteQuarantine,
  fetchFiles,
  fetchIndexHealth,
  fetchQuarantine,
  fetchStatus,
  fetchTree,
  fileUrl,
  rebuildIndex,
  reindexAll,
  retryQuarantine,
  uploadFile,
  type GedCategory,
  type GedFile,
  type GedStatus,
  type GedSubfolder,
  type IndexHealth,
  type QuarantineEntry,
} from "@/lib/api/documents";

type Tab = "bibliotheque" | "quarantaine" | "sante";

interface FolderOption {
  path: string;
  label: string;
  depth: number;
}

function flattenFolders(categories: GedCategory[]): FolderOption[] {
  const out: FolderOption[] = [];
  for (const cat of categories) {
    out.push({ path: cat.name, label: cat.label, depth: 0 });
    const walk = (nodes: GedSubfolder[], depth: number) => {
      for (const n of nodes) {
        out.push({ path: n.path, label: n.name, depth });
        walk(n.subfolders, depth + 1);
      }
    };
    walk(cat.subfolders, 1);
  }
  return out;
}

export function DocumentsView({
  initialCategories,
  initialStatus,
  initialFiles,
  initialQuarantine,
  initialRetentionDays,
}: {
  initialCategories: GedCategory[];
  initialStatus: GedStatus;
  initialFiles: GedFile[];
  initialQuarantine: QuarantineEntry[];
  initialRetentionDays: number;
}) {
  const [tab, setTab] = useState<Tab>("bibliotheque");
  const [categories, setCategories] = useState(initialCategories);
  const [status, setStatus] = useState(initialStatus);
  const [files, setFiles] = useState(initialFiles);
  const [quarantine, setQuarantine] = useState(initialQuarantine);
  const [retentionDays, setRetentionDays] = useState(initialRetentionDays);
  const [health, setHealth] = useState<IndexHealth | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<GedFile | null>(null);
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  const folderOptions = useMemo(() => flattenFolders(categories), [categories]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // Recharge la liste de fichiers quand le dossier ou la recherche change (debounce recherche).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refreshFiles();
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, search]);

  useEffect(() => {
    if (tab === "sante" && !health) {
      fetchIndexHealth().then(setHealth).catch((e) => setError(e instanceof Error ? e.message : "erreur"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function refreshFiles() {
    try {
      const f = await fetchFiles(folder ?? undefined, search || undefined);
      setFiles(f.files);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur inconnue");
    }
  }

  async function refreshAll() {
    try {
      const [t, s] = await Promise.all([fetchTree(), fetchStatus()]);
      setCategories(t.categories);
      setStatus(s);
      await refreshFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur inconnue");
    }
  }

  async function refreshQuarantine() {
    try {
      const q = await fetchQuarantine();
      setQuarantine(q.quarantine);
      setRetentionDays(q.retention_days);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur inconnue");
    }
  }

  async function handleUpload(file: File, folderPath: string) {
    setBusy(true);
    setError(null);
    try {
      await uploadFile(file, folderPath);
      setUploadOpen(false);
      await refreshAll();
      await refreshQuarantine();
      pollAfterUpload(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur d'upload");
    } finally {
      setBusy(false);
    }
  }

  /**
   * L'upload lance l'indexation en arrière-plan (parsing + extraction LLM + embeddings,
   * plusieurs secondes) : le refreshAll() immédiat ci-dessus arrive systématiquement trop
   * tôt. On sonde jusqu'à ce que le fichier ressorte indexé (ou parte en quarantaine),
   * sans quoi le compteur "Documents indexés" et le badge du fichier restent figés.
   */
  function pollAfterUpload(filename: string, attempt = 0) {
    if (pollRef.current) clearTimeout(pollRef.current);
    setPendingFilename(filename);
    if (attempt >= 20) {
      setPendingFilename(null);
      return;
    }
    pollRef.current = setTimeout(async () => {
      try {
        const [f, q] = await Promise.all([fetchFiles(folder ?? undefined, search || undefined), fetchQuarantine()]);
        setFiles(f.files);
        setQuarantine(q.quarantine);
        setRetentionDays(q.retention_days);
        const inQuarantine = q.quarantine.some((x) => x.filename === filename);
        const nowIndexed = f.files.some((x) => x.filename === filename && x.is_indexed);
        if (inQuarantine || nowIndexed) {
          setPendingFilename(null);
          const [t, s] = await Promise.all([fetchTree(), fetchStatus()]);
          setCategories(t.categories);
          setStatus(s);
        } else {
          pollAfterUpload(filename, attempt + 1);
        }
      } catch {
        // best-effort : on abandonne silencieusement, l'utilisateur peut recharger la page
        setPendingFilename(null);
      }
    }, 3000);
  }

  async function handleDelete(f: GedFile) {
    if (!f.doc_id) return;
    setBusy(true);
    try {
      await deleteFile(f.doc_id);
      await refreshAll();
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur de suppression");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuarantineAction(action: "retry" | "force" | "delete", entry: QuarantineEntry) {
    setBusy(true);
    try {
      if (action === "retry") await retryQuarantine(entry.file_path, false);
      if (action === "force") await retryQuarantine(entry.file_path, true);
      if (action === "delete") await deleteQuarantine(entry.file_path);
      await refreshQuarantine();
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleReindex(force: boolean) {
    setBusy(true);
    try {
      const r = await reindexAll(force);
      setError(null);
      window.alert(r.message);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur de réindexation");
    } finally {
      setBusy(false);
    }
  }

  async function handleRebuild() {
    setBusy(true);
    try {
      const r = await rebuildIndex();
      setConfirmRebuild(false);
      window.alert(r.message);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erreur de reconstruction");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ViewHeader
        eyebrow="● gestion documentaire"
        title="Documents (GED)"
        sub="Bibliothèque des documents indexés pour la recherche IA — CV, offres techniques, procédures, comptes rendus…"
      >
        <button
          onClick={() => setUploadOpen(true)}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white"
        >
          + Ajouter un document
        </button>
      </ViewHeader>

      {pendingFilename && (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-line border-l-[3px] border-l-ai bg-panel px-3.5 py-2.5 text-[12px] text-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ai border-t-transparent" />
          Indexation de <span className="font-mono text-text">{pendingFilename}</span> en cours…
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Documents indexés" value={status.total_indexed.toLocaleString("fr-FR")} />
        <StatCard label="Fichiers sur disque" value={status.total_on_disk.toLocaleString("fr-FR")} />
        <StatCard label="Catégories" value={categories.length.toString()} />
        <StatCard
          label="Dernière indexation"
          value={status.last_indexed_at ? new Date(status.last_indexed_at).toLocaleString("fr-FR") : "—"}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-l-[3px] border-line border-l-bad bg-panel px-3.5 py-2.5 text-[12px] text-bad">
          {error}
        </div>
      )}

      <SegmentedTabs
        tabs={[
          { key: "bibliotheque", label: "Bibliothèque", count: files.length },
          { key: "quarantaine", label: "Quarantaine", count: quarantine.length },
          { key: "sante", label: "Santé de l'index" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "bibliotheque" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[240px_1fr]">
          <Panel>
            <PanelHead title="Catégories" />
            <FolderTree categories={categories} selected={folder} onSelect={setFolder} />
          </Panel>

          <Panel>
            <PanelHead title={folder ? `Fichiers — ${folder}` : "Tous les fichiers"}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un fichier…"
                className="w-56 rounded-[9px] border border-line bg-panel px-2.5 py-1.5 text-[12px] text-text focus:border-ai focus:outline-none"
              />
            </PanelHead>
            <FileTable
              files={files}
              onDelete={setConfirmDelete}
            />
          </Panel>
        </div>
      )}

      {tab === "quarantaine" && (
        <Panel>
          <PanelHead title="Fichiers en quarantaine" />
          <p className="mb-3.5 text-[11.5px] leading-relaxed text-muted">
            Fichiers rejetés par le validateur qualité (texte trop court, PDF scanné sans OCR
            exploitable…) — en attente de correction. Rétention : {retentionDays} jour{retentionDays > 1 ? "s" : ""}.
          </p>
          {quarantine.length === 0 ? (
            <p className="text-[12.5px] text-muted">Aucun fichier en quarantaine.</p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  {["Fichier", "Type", "Motif", "Mis en quarantaine", "Tentatives", ""].map((h) => (
                    <th
                      key={h}
                      className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quarantine.map((q) => (
                  <tr key={q.id} className="border-b border-line last:border-none">
                    <td className="px-2 py-2.5 text-text">{q.filename}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant="warm">{q.doc_type}</Badge>
                    </td>
                    <td className="max-w-[280px] px-2 py-2.5 text-muted">{q.reason}</td>
                    <td className="px-2 py-2.5 font-mono text-[11px] text-muted">
                      {new Date(q.quarantined_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-2 py-2.5 text-center">{q.retry_count}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <ActionButton onClick={() => handleQuarantineAction("retry", q)} disabled={busy}>
                          Réessayer
                        </ActionButton>
                        <ActionButton onClick={() => handleQuarantineAction("force", q)} disabled={busy}>
                          Forcer
                        </ActionButton>
                        <ActionButton onClick={() => handleQuarantineAction("delete", q)} disabled={busy} danger>
                          Supprimer
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === "sante" && (
        <Panel>
          <PanelHead title="Santé de l'index vectoriel" />
          {!health ? (
            <p className="text-[12.5px] text-muted">Chargement…</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-3">
                <StatCard label="Documents au registre" value={String(health.registry_documents ?? "—")} />
                <StatCard
                  label="Orphelins (registre sans chunks)"
                  value={String(health.anomalies?.in_registry_without_chunks?.length ?? 0)}
                />
                <StatCard
                  label="Orphelins (index sans registre)"
                  value={String(health.anomalies?.in_vector_without_registry?.length ?? 0)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={() => handleReindex(false)} disabled={busy}>
                  Indexer les nouveaux fichiers
                </ActionButton>
                <ActionButton onClick={() => handleReindex(true)} disabled={busy}>
                  Ré-indexer tout
                </ActionButton>
                {confirmRebuild ? (
                  <ActionButton onClick={handleRebuild} disabled={busy} danger>
                    ⚠ Confirmer la reconstruction complète
                  </ActionButton>
                ) : (
                  <ActionButton onClick={() => setConfirmRebuild(true)} disabled={busy} danger>
                    Reconstruction complète…
                  </ActionButton>
                )}
              </div>
            </>
          )}
        </Panel>
      )}

      {uploadOpen && <UploadModal
        open={uploadOpen}
        busy={busy}
        folderOptions={folderOptions}
        defaultFolder={folder ?? folderOptions[0]?.path ?? ""}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleUpload}
        onCreateFolder={async (path) => {
          await createFolder(path);
          await refreshAll();
        }}
      />}

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} className="max-w-[420px] p-6">
          <h2 className="mb-2 text-[16px]">Supprimer ce document ?</h2>
          <p className="mb-4 text-[12.5px] leading-relaxed text-muted">
            <span className="font-mono text-text">{confirmDelete.filename}</span> sera supprimé du
            disque, de l&apos;index vectoriel et du registre. Action irréversible.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="flex-1 cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-[9px] text-[12.5px] text-text"
            >
              Annuler
            </button>
            <button
              onClick={() => handleDelete(confirmDelete)}
              disabled={busy}
              className="flex-1 cursor-pointer rounded-lg bg-bad px-3 py-[9px] text-[12.5px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-3.5">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="font-mono text-[17px] text-text">{value}</div>
    </Panel>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11.5px] disabled:opacity-50",
        danger
          ? "border-bad/40 bg-bad/10 text-bad hover:border-bad"
          : "border-line bg-panel-2 text-text hover:border-ai",
      )}
    >
      {children}
    </button>
  );
}

function FolderTree({
  categories,
  selected,
  onSelect,
}: {
  categories: GedCategory[];
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <TreeButton label="Tous les documents" count={null} active={selected === null} depth={0} onClick={() => onSelect(null)} />
      {categories.map((c) => (
        <FolderCategoryNode key={c.name} category={c} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function FolderCategoryNode({
  category,
  selected,
  onSelect,
}: {
  category: GedCategory;
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  return (
    <>
      <TreeButton
        label={category.label}
        count={category.file_count}
        active={selected === category.name}
        depth={0}
        onClick={() => onSelect(category.name)}
      />
      {category.subfolders.map((s) => (
        <SubfolderNode key={s.path} node={s} depth={1} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

function SubfolderNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: GedSubfolder;
  depth: number;
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  return (
    <>
      <TreeButton
        label={node.name}
        count={node.file_count}
        active={selected === node.path}
        depth={depth}
        onClick={() => onSelect(node.path)}
      />
      {node.subfolders.map((s) => (
        <SubfolderNode key={s.path} node={s} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

function TreeButton({
  label,
  count,
  active,
  depth,
  onClick,
}: {
  label: string;
  count: number | null;
  active: boolean;
  depth: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ paddingLeft: `${10 + depth * 14}px` }}
      className={clsx(
        "flex items-center justify-between gap-2 rounded-lg py-1.5 pr-2.5 text-left text-[12.5px] transition",
        active ? "bg-ai text-white" : "text-muted hover:bg-panel-2 hover:text-text",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== null && (
        <span className={clsx("font-mono text-[10px]", active ? "text-white/80" : "text-muted")}>{count}</span>
      )}
    </button>
  );
}

function FileTable({
  files,
  onDelete,
}: {
  files: GedFile[];
  onDelete: (f: GedFile) => void;
}) {
  if (files.length === 0) {
    return <p className="text-[12.5px] text-muted">Aucun fichier.</p>;
  }
  return (
    <div className="max-h-[65vh] overflow-y-auto overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {["Fichier", "Catégorie", "Taille", "Statut", ""].map((h) => (
              <th
                key={h}
                className="sticky top-0 z-10 border-b border-line bg-panel px-2 pb-2 pt-1 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.file_path} className="border-b border-line last:border-none">
              <td className="px-2 py-2.5 text-text">{f.filename}</td>
              <td className="px-2 py-2.5">
                <Badge variant="warm">{f.category}</Badge>
              </td>
              <td className="px-2 py-2.5 font-mono text-[11px] text-muted">{fmtBytes(f.size_bytes)}</td>
              <td className="px-2 py-2.5">
                <Badge variant={f.is_indexed ? "open" : "risk"}>{f.is_indexed ? "indexé" : "non indexé"}</Badge>
              </td>
              <td className="px-2 py-2.5">
                <div className="flex justify-end gap-1.5">
                  {f.doc_id && (
                    <>
                      <ActionButton onClick={() => window.open(fileUrl(f.doc_id!, true), "_blank")}>
                        Aperçu
                      </ActionButton>
                      <ActionButton onClick={() => window.open(fileUrl(f.doc_id!, false), "_blank")}>
                        Télécharger
                      </ActionButton>
                      <ActionButton onClick={() => onDelete(f)} danger>
                        Supprimer
                      </ActionButton>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadModal({
  open,
  busy,
  folderOptions,
  defaultFolder,
  onClose,
  onSubmit,
  onCreateFolder,
}: {
  open: boolean;
  busy: boolean;
  folderOptions: FolderOption[];
  defaultFolder: string;
  onClose: () => void;
  onSubmit: (file: File, folderPath: string) => Promise<void>;
  onCreateFolder: (path: string) => Promise<void>;
}) {
  const [folderPath, setFolderPath] = useState(defaultFolder);
  const [newFolder, setNewFolder] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    if (!file) {
      setLocalError("Choisissez un fichier.");
      return;
    }
    if (!folderPath) {
      setLocalError("Choisissez un dossier de destination.");
      return;
    }
    setLocalError(null);
    await onSubmit(file, folderPath);
  }

  async function addFolder() {
    const parent = folderPath || folderOptions[0]?.path || "";
    const name = newFolder.trim();
    if (!name) return;
    const path = `${parent}/${name}`;
    await onCreateFolder(path);
    setFolderPath(path);
    setNewFolder("");
  }

  return (
    <Modal open onClose={onClose} className="max-w-[480px] p-6">
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-[16px]">Ajouter un document</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-muted hover:border-ai hover:text-text"
        >
          Fermer ✕
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] text-muted">Dossier de destination</div>
          <select
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 text-xs text-text focus:border-ai focus:outline-none"
          >
            {folderOptions.map((f) => (
              <option key={f.path} value={f.path}>
                {"— ".repeat(f.depth)}
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] text-muted">Créer un sous-dossier dans la sélection ci-dessus</div>
          <div className="flex gap-2">
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="nom-du-sous-dossier"
              className="flex-1 rounded-[9px] border border-line bg-panel px-2.5 py-2 text-xs text-text focus:border-ai focus:outline-none"
            />
            <button
              onClick={addFolder}
              className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[11.5px] text-text hover:border-ai"
            >
              Créer
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] text-muted">Fichier (PDF, DOCX, DOC, TXT)</div>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 text-xs text-text"
          />
        </div>
      </div>

      {localError && <div className="mt-3 text-[11.5px] text-bad">{localError}</div>}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-4 w-full cursor-pointer rounded-lg bg-ai px-3 py-[9px] text-[12.5px] font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Envoi et indexation…" : "Envoyer"}
      </button>
    </Modal>
  );
}
