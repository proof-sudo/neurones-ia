import { authHeader } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1";

/** Fetch authentifié avec timeout 30s — lève une erreur si 401 (session expirée) */
async function apiFetch(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const headers = { ...authHeader(), ...(init.headers as Record<string, string> ?? {}) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        const { clearAuth } = await import("@/lib/auth");
        clearAuth();
        window.location.replace("/login");
      }
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export interface DashboardStats {
  clients: number;
  invoices_total: number;
  invoices_paid: number;
  sale_orders: number;
  opportunities: number;
}

export async function fetchStats(): Promise<DashboardStats> {
  const response = await apiFetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error(`Stats error: ${response.status}`);
  return response.json();
}

export interface Source {
  doc_id: string;
  filename: string;
  doc_type: string;
  excerpt: string;
  relevance_score: number;
}

export interface ScoringResult {
  ao_filename: string;
  summary: string;
  key_elements: { category: string; value: string }[];
  matched_documents: { doc_id: string; filename: string; doc_type: string; relevance_score: number; excerpt: string }[];
  gaps_analysis: string;
  strengths: string[];
  risks: string[];
  score: number;
  recommendation: "GO" | "NO_BID" | "CONDITIONAL";
  justification: string;
  criteres_selection?: string[];
  besoins?: string[];
  prerequis?: string[];
  ressources_demandees?: string[];
  points_vigilance?: string[];
  date_remise?: string;
  team_matches?: { doc_id: string; filename: string; doc_type: string; relevance_score: number; excerpt: string }[];
  similar_projects?: { doc_id: string; filename: string; doc_type: string; relevance_score: number; excerpt: string }[];
}

export interface BidStrategy {
  strategy: string;
  chronogram: { semaine: string; action: string; responsable: string }[];
  response_plan: string;
}

export interface TeamProfile {
  filename: string;
  name: string;
  excerpt: string;
  relevance_score: number;
  match_reasons: string[];
}

export interface TeamMatchResult {
  profiles: TeamProfile[];
  query_used: string;
}

export async function matchTeam(
  requirements: string[],
  aoContext: string = "",
  topK: number = 6,
): Promise<TeamMatchResult> {
  const res = await apiFetch(`${API_BASE}/presales/match-team`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirements, ao_context: aoContext, top_k: topK }),
  });
  if (!res.ok) throw new Error(`match-team error: ${res.status}`);
  return res.json();
}

export interface ChatSession {
  session_id: string;
  title: string;
  started_at: string | null;
  last_at: string | null;
  turn_count: number;
}

export async function fetchChatSessions(limit = 30): Promise<ChatSession[]> {
  const res = await apiFetch(`${API_BASE}/chat/sessions?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
  const data = await res.json();
  return data.sessions ?? [];
}

export async function fetchSessionHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
  const res = await apiFetch(`${API_BASE}/chat/sessions/${sessionId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? [];
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await apiFetch(`${API_BASE}/chat/session/${sessionId}`, { method: "DELETE" });
}

export async function* streamChat(
  text: string,
  history: { role: string; content: string }[],
  sessionId: string,
  files?: File[],
  signal?: AbortSignal,
): AsyncGenerator<{ type: string; content?: string; sources?: Source[]; intent?: string; tool?: string; label?: string }> {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("session_id", sessionId);
  formData.append("history", JSON.stringify(history));
  files?.forEach((f) => formData.append("files", f));

  const response = await fetch(`${API_BASE}/chat/query`, {
    method: "POST",
    headers: authHeader(),
    body: formData,
    signal,
  });

  if (response.status === 401) {
    const { clearAuth } = await import("@/lib/auth");
    clearAuth();
    window.location.replace("/login");
    return;
  }
  if (!response.ok) throw new Error(`Chat error: ${response.status}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // ignore malformed lines
        }
      }
    }
  }
}

export async function scoreAO(file: File): Promise<ScoringResult> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/presales/score`, {
      method: "POST",
      headers: authHeader(),
      body: formData,
    });
  } catch (e) {
    const name = (e != null && typeof e === "object" && "name" in e) ? (e as { name: unknown }).name : "";
    const msg  = String(e instanceof Error ? e.message : e);
    if (name === "AbortError" || msg.toLowerCase().includes("abort")) {
      throw new Error("Analyse annulée — connexion interrompue.");
    }
    throw new Error(`Serveur inaccessible (${API_BASE.replace("/v1", "")}) — vérifiez que le backend est démarré.`);
  }

  if (response.status === 401) {
    const { clearAuth } = await import("@/lib/auth");
    clearAuth();
    window.location.replace("/login");
    throw new Error("Session expirée — reconnexion en cours…");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as Record<string, string>;
    throw new Error((error as { detail?: string }).detail ?? `Erreur serveur ${response.status}`);
  }

  return response.json() as Promise<ScoringResult>;
}

// ── GED ───────────────────────────────────────────────────────────────────────

export interface GEDCategory {
  name: string;
  label: string;
  doc_type: string;
  file_count: number;
  subfolders: GEDFolder[];
}

export interface GEDFolder {
  path: string;
  name: string;
  file_count: number;
  subfolders: GEDFolder[];
}

export interface GEDFile {
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

export interface GEDStatus {
  total_indexed: number;
  total_on_disk: number;
  by_type: Record<string, number>;
  last_indexed_at: string | null;
}

export async function fetchGEDTree(): Promise<{ categories: GEDCategory[] }> {
  const r = await apiFetch(`${API_BASE}/ged/tree`);
  if (!r.ok) throw new Error(`GED tree error: ${r.status}`);
  return r.json();
}

export async function fetchGEDStatus(): Promise<GEDStatus> {
  const r = await apiFetch(`${API_BASE}/ged/status`);
  if (!r.ok) throw new Error(`GED status error: ${r.status}`);
  return r.json();
}

export async function fetchGEDFiles(folder?: string, search?: string): Promise<{ files: GEDFile[]; total: number }> {
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (search) params.set("search", search);
  const r = await apiFetch(`${API_BASE}/ged/files?${params}`);
  if (!r.ok) throw new Error(`GED files error: ${r.status}`);
  return r.json();
}

export async function uploadGEDFile(file: File, folderPath: string): Promise<{ filename: string; doc_type: string; size_bytes: number; status: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder_path", folderPath);
  const r = await apiFetch(`${API_BASE}/ged/upload`, { method: "POST", body: form });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Upload error: ${r.status}`);
  }
  return r.json();
}

export async function deleteGEDFile(docId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/ged/files/${docId}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`Delete error: ${r.status}`);
}

export async function createGEDFolder(path: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/ged/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Create folder error: ${r.status}`);
  }
}

export async function reindexGED(force = false): Promise<{ queued: number; message: string }> {
  const url = `${API_BASE}/ged/reindex${force ? "?force=true" : ""}`;
  const r = await apiFetch(url, { method: "POST" });
  if (!r.ok) throw new Error(`Reindex error: ${r.status}`);
  return r.json();
}

export async function deleteGEDFolder(path: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/ged/folders?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Delete folder error: ${r.status}`);
  }
}

export interface GEDQuarantineEntry {
  id: number;
  filename: string;
  file_path: string;
  doc_type: string;
  reason: string;
  quarantined_at: string;
  retry_count: number;
  file_size_bytes: number;
  text_length: number;
}

export async function fetchGEDQuarantine(): Promise<{ quarantine: GEDQuarantineEntry[]; total: number }> {
  const r = await apiFetch(`${API_BASE}/ged/quarantine`);
  if (!r.ok) throw new Error(`Quarantine error: ${r.status}`);
  return r.json();
}

export async function retryGEDQuarantine(filePath: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/ged/quarantine/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Retry error: ${r.status}`);
  }
}

// ── GED — Inspection (chunks, métadonnées, recherche, santé) ──────────────────

export interface GEDChunk {
  chunk_id: string;
  chunk_index: number;
  is_parent: boolean;
  parent_chunk_id: string | null;
  word_count: number;
  char_count: number;
  content: string;
}

export interface GEDDocumentChunks {
  doc_id: string;
  filename: string;
  doc_type: string;
  contains_pii: boolean;
  chunk_count: number;
  extracted_fields: Record<string, unknown>;
  chunks: GEDChunk[];
}

export async function fetchGEDDocumentChunks(docId: string): Promise<GEDDocumentChunks> {
  const r = await apiFetch(`${API_BASE}/ged/documents/${docId}/chunks`);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Chunks error: ${r.status}`);
  }
  return r.json();
}

export interface GEDSearchHit {
  chunk_id: string;
  doc_id: string | null;
  filename: string | null;
  doc_type: string | null;
  dense_rank: number | null;
  dense_score: number | null;
  sparse_rank: number | null;
  sparse_score: number | null;
  rrf_score: number;
  excerpt: string;
  word_count: number;
}

export interface GEDSearchDebug {
  query: string;
  doc_type: string | null;
  top_k: number;
  dense_hits: number;
  sparse_hits: number;
  results: GEDSearchHit[];
}

export async function searchGEDDebug(query: string, topK = 10, docType?: string): Promise<GEDSearchDebug> {
  const r = await apiFetch(`${API_BASE}/ged/search-debug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK, doc_type: docType ?? null }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Search error: ${r.status}`);
  }
  return r.json();
}

export interface GEDProdHit {
  chunk_id: string;
  doc_id: string;
  filename: string;
  doc_type: string;
  relevance_score: number;
  expanded_from_parent: boolean;
  parent_chunk_id: string | null;
  excerpt: string;
  context_words: number;
  context_tokens: number;
  context_chars: number;
  context_preview: string;
}

export interface GEDSearchProd {
  query: string;
  doc_type: string | null;
  count: number;
  rerank_requested: boolean;
  reranker_available: boolean;
  rerank_applied: boolean;
  score_label: string;
  results: GEDProdHit[];
}

export async function searchGEDProd(query: string, topK = 10, docType?: string, rerank = false): Promise<GEDSearchProd> {
  const r = await apiFetch(`${API_BASE}/ged/search-prod`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK, doc_type: docType ?? null, rerank }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Search error: ${r.status}`);
  }
  return r.json();
}

export interface GEDIndexHealth {
  total_chunks: number;
  total_documents: number;
  parent_chunks: number;
  child_chunks: number;
  avg_chunks_per_doc: number;
  avg_words_per_chunk: number;
  by_doc_type: Record<string, { documents: number; chunks: number }>;
  per_document: {
    doc_id: string;
    filename: string;
    doc_type: string;
    chunk_count: number;
    parent_count: number;
    avg_words: number;
  }[];
  registry_documents: number;
  anomalies: {
    in_registry_without_chunks: { doc_id: string; filename: string }[];
    in_vector_without_registry: string[];
  };
}

export async function fetchGEDIndexHealth(): Promise<GEDIndexHealth> {
  const r = await apiFetch(`${API_BASE}/ged/index-health`);
  if (!r.ok) throw new Error(`Index health error: ${r.status}`);
  return r.json();
}

export async function generateBidStrategy(
  scoringResult: ScoringResult,
  decision: string,
  clientName?: string,
  decisionReason?: string,
): Promise<BidStrategy> {
  const response = await apiFetch(`${API_BASE}/presales/bid-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scoring_result: scoringResult,
      client_name: clientName,
      decision,
      decision_reason: decisionReason,
    }),
  }, 120_000);
  if (!response.ok) throw new Error(`Strategy error: ${response.status}`);
  return response.json();
}

export async function exportAnalysis(scoringResult: ScoringResult, clientName?: string): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/export-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scoring_result: scoringResult, client_name: clientName }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export error: ${response.status}`);
  return response.blob();
}

export async function exportScoring(scoringResult: ScoringResult, clientName?: string): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/export-scoring`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scoring_result: scoringResult, client_name: clientName }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export scoring error: ${response.status}`);
  return response.blob();
}

export async function exportStrategy(
  scoringResult: ScoringResult,
  strategy: string,
  chronogram: { semaine: string; action: string; responsable: string }[],
  responsePlan: string,
  clientName?: string,
  decision?: string,
): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/export-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scoring_result: scoringResult,
      strategy,
      chronogram,
      response_plan: responsePlan,
      client_name: clientName,
      decision: decision ?? "GO",
    }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export stratégie error: ${response.status}`);
  return response.blob();
}

export async function generateOffer(scoringResult: ScoringResult, clientName?: string): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ao_filename: scoringResult.ao_filename,
      scoring_result: scoringResult,
      client_name: clientName,
    }),
  }, 180_000);
  if (!response.ok) throw new Error(`Generate error: ${response.status}`);
  return response.blob();
}

export async function exportChecklist(
  aoFilename: string,
  items: { category: string; label: string; required: boolean; checked: boolean; note: string }[],
  clientName?: string,
  submissionDate?: string,
): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/export-checklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ao_filename: aoFilename,
      client_name: clientName,
      submission_date: submissionDate ?? "",
      items,
    }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export checklist error: ${response.status}`);
  return response.blob();
}

// ── Veille Appels d'Offres ────────────────────────────────────────────────────

export interface VeilleEntry {
  id: number;
  source_id: number | null;
  title: string;
  url: string;
  description: string;
  published_at: string | null;
  detected_at: string;
  status: string;
  estimated_budget: string;
  deadline: string;
  country: string;
  relevance_score: number;
}

export interface VeilleSource {
  id: number;
  name: string;
  url: string;
  feed_type: string;
  keywords: string;
  active: boolean;
  last_scan: string | null;
}

export async function fetchVeilleFeed(limit = 50, status = ""): Promise<VeilleEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  const res = await apiFetch(`${API_BASE}/veille/feed?${params}`);
  if (!res.ok) throw new Error(`veille feed error: ${res.status}`);
  return res.json();
}

export async function fetchVeilleStats(): Promise<{ total: number; new: number }> {
  const res = await apiFetch(`${API_BASE}/veille/stats`);
  if (!res.ok) return { total: 0, new: 0 };
  return res.json();
}

export async function fetchVeilleSources(): Promise<VeilleSource[]> {
  const res = await apiFetch(`${API_BASE}/veille/sources`);
  if (!res.ok) return [];
  return res.json();
}

export async function addVeilleSource(data: { name: string; url: string; feed_type: string; keywords: string }): Promise<VeilleSource> {
  const res = await apiFetch(`${API_BASE}/veille/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur création source");
  return res.json();
}

export async function deleteVeilleSource(id: number): Promise<void> {
  await apiFetch(`${API_BASE}/veille/sources/${id}`, { method: "DELETE" });
}

export async function patchVeilleEntry(id: number, status: string): Promise<VeilleEntry> {
  const res = await apiFetch(`${API_BASE}/veille/entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Erreur patch entry");
  return res.json();
}

export async function triggerVeilleScan(): Promise<void> {
  await apiFetch(`${API_BASE}/veille/scan`, { method: "POST" });
}

export async function initVeilleDemoSources(): Promise<void> {
  await apiFetch(`${API_BASE}/veille/init-demo`, { method: "POST" });
}
