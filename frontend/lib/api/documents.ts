/**
 * Client API du module Documents (GED) — mêmes conventions que lib/presales-api.ts :
 * les appels passent par le proxy Next /api/backend/ged/* qui injecte le JWT
 * httpOnly côté serveur (le proxy autorise déjà les chemins `ged/*`).
 */

const API_BASE = "/api/backend/ged";

async function apiFetch(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: init.signal ?? controller.signal });
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.replace("/");
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function ok<T>(r: Response, fallback: string): Promise<T> {
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `${fallback} (${r.status})`);
  }
  return r.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

/** Sous-dossier d'une catégorie — pas de label/doc_type propre, `path` sert de filtre `folder`. */
export interface GedSubfolder {
  path: string;
  name: string;
  file_count: number;
  subfolders: GedSubfolder[];
}

/** Catégorie racine (cvs, offres-techniques, …) — `name` sert directement de filtre `folder`. */
export interface GedCategory {
  name: string;
  label: string;
  doc_type: string;
  file_count: number;
  subfolders: GedSubfolder[];
}

export interface GedStatus {
  total_indexed: number;
  total_on_disk: number;
  by_type: Record<string, number>;
  last_indexed_at: string | null;
}

export interface GedFile {
  doc_id: string | null;
  filename: string;
  file_path: string;
  folder_path: string;
  category: string;
  doc_type: string;
  size_bytes: number;
  last_indexed: string | null;
  is_indexed: boolean;
}

export interface QuarantineEntry {
  id: string | number;
  filename: string;
  file_path: string;
  doc_type: string;
  reason: string;
  quarantined_at: string;
  retry_count: number;
  file_size_bytes: number;
  text_length: number;
}

export interface IndexHealth {
  registry_documents: number;
  anomalies: {
    in_registry_without_chunks: { doc_id: string; filename: string }[];
    in_vector_without_registry: string[];
  };
  [key: string]: unknown;
}

// ── Lecture ────────────────────────────────────────────────────────────────

export async function fetchTree(): Promise<{ categories: GedCategory[] }> {
  const r = await apiFetch(`${API_BASE}/tree`);
  return ok(r, "Erreur chargement arborescence");
}

export async function fetchStatus(): Promise<GedStatus> {
  const r = await apiFetch(`${API_BASE}/status`);
  return ok(r, "Erreur chargement des statistiques");
}

export async function fetchFiles(folder?: string, search?: string): Promise<{ files: GedFile[]; total: number }> {
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (search) params.set("search", search);
  const r = await apiFetch(`${API_BASE}/files?${params}`);
  return ok(r, "Erreur chargement des fichiers");
}

export async function fetchQuarantine(): Promise<{ quarantine: QuarantineEntry[]; total: number; retention_days: number }> {
  const r = await apiFetch(`${API_BASE}/quarantine`);
  return ok(r, "Erreur chargement de la quarantaine");
}

export async function fetchIndexHealth(): Promise<IndexHealth> {
  const r = await apiFetch(`${API_BASE}/index-health`);
  return ok(r, "Erreur chargement de la santé de l'index");
}

/** URL directe (téléchargement ou aperçu inline) — à utiliser dans un lien/window.open. */
export function fileUrl(docId: string, inline = false): string {
  return `${API_BASE}/files/${docId}/download${inline ? "?inline=true" : ""}`;
}

export interface FileMeta {
  size_bytes: number | null;
  last_indexed: string | null;
}

/** Métadonnées légères (taille, date) pour un lot de doc_id — alimente les colonnes
 * Taille/Date d'un tableau de documents matchés sans reservir le fichier lui-même. */
export async function fetchFilesMeta(docIds: string[]): Promise<Record<string, FileMeta>> {
  const ids = [...new Set(docIds.filter(Boolean))];
  if (!ids.length) return {};
  const r = await apiFetch(`${API_BASE}/files/meta?ids=${ids.map(encodeURIComponent).join(",")}`);
  const data = await ok<{ files: Record<string, FileMeta> }>(r, "Erreur chargement des métadonnées fichiers");
  return data.files;
}

// ── Écriture ───────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  folderPath: string,
): Promise<{ filename: string; doc_type: string; size_bytes: number; status: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder_path", folderPath);
  const r = await apiFetch(`${API_BASE}/upload`, { method: "POST", body: form }, 120_000);
  return ok(r, "Erreur d'upload");
}

export async function deleteFile(docId: string): Promise<{ deleted: boolean; filename: string }> {
  const r = await apiFetch(`${API_BASE}/files/${docId}`, { method: "DELETE" });
  return ok(r, "Erreur de suppression");
}

export async function createFolder(path: string): Promise<{ path: string; created: boolean }> {
  const r = await apiFetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return ok(r, "Erreur création du dossier");
}

export async function deleteFolder(path: string): Promise<{ deleted: boolean; path: string; files_deindexed: number }> {
  const r = await apiFetch(`${API_BASE}/folders?${new URLSearchParams({ path })}`, { method: "DELETE" });
  return ok(r, "Erreur suppression du dossier");
}

export async function retryQuarantine(
  filePath: string,
  forceIndex = false,
): Promise<{ status: string; file_path: string; force_index: boolean }> {
  const r = await apiFetch(`${API_BASE}/quarantine/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath, force_index: forceIndex }),
  });
  return ok(r, "Erreur de relance");
}

export async function deleteQuarantine(
  filePath: string,
): Promise<{ deleted: boolean; file_path: string; file_removed: boolean; entries_removed: number }> {
  const r = await apiFetch(`${API_BASE}/quarantine?${new URLSearchParams({ file_path: filePath })}`, {
    method: "DELETE",
  });
  return ok(r, "Erreur suppression quarantaine");
}

export async function reindexAll(force = false): Promise<{ queued: number; force: boolean; message: string }> {
  const params = force ? "?force=true" : "";
  const r = await apiFetch(`${API_BASE}/reindex${params}`, { method: "POST" });
  return ok(r, "Erreur de réindexation");
}

export async function rebuildIndex(): Promise<{ reset: unknown; queued: number; message: string }> {
  const r = await apiFetch(`${API_BASE}/rebuild`, { method: "POST" }, 60_000);
  return ok(r, "Erreur de reconstruction de l'index");
}
