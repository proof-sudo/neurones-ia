/**
 * Client API du module Avant-vente — port de lib/api.ts du projet
 * neurones-ia-main, adapté à l'architecture du cockpit : les appels passent
 * par le proxy Next /api/backend/* qui injecte le JWT httpOnly côté serveur
 * (aucun token côté navigateur, contrairement au projet source qui lisait
 * localStorage). Un 401 signifie session expirée → retour à la connexion.
 */

const API_BASE = "/api/backend";

/** Fetch même-origine avec timeout — redirige vers la connexion si session expirée. */
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

// ── Types du scoring AO ───────────────────────────────────────────────────────

export interface MarketIdentity {
  type_marche: string;
  reference: string;
  autorite_contractante: string;
  duree_contrat: string;
  date_demarrage: string;
  deadline_soumission: string;
  validite_offre: string;
  perimetre_geographique: string;
  eligibilite_candidat: string;
  confidence: number;
}

export interface CalendarEvent {
  label: string;
  date: string;
  criticite: "BLOQUANT" | "CRITIQUE" | "INFO";
  source_section: string;
}

export interface EvaluationModalities {
  ponderation_technique: number;
  ponderation_financiere: number;
  seuil_minimum_technique: number;
  formule_notation_financiere: string;
  modalites: string[];
  confidence: number;
}

export type RiskLevel = "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" | "CRITIQUE";
export type RiskCriticite = "MODÉRÉ" | "ÉLEVÉ" | "CRITIQUE" | "BLOQUANT";

export interface ScoringCriterion {
  id: string;
  label: string;
  max_points: number;
  category: string;
  is_inferred: boolean;
  estimated_score: number;
  risk_level: RiskLevel;
  rationale: string;
  sources_ged: string[];
}

export interface Risk {
  label: string;
  criticite: RiskCriticite;
  pourquoi: string;
  mitigation: string;
  items_affected: string[];
}

export interface Precondition {
  label: string;
  type: "FINANCIER" | "ADMIN" | "TECHNIQUE" | "PARTENARIAT";
  deadline: string;
  responsable: string;
  status: string;
  blocking: boolean;
  pieces_requises: string[];
}

export interface Appendix {
  code: string;
  label: string;
  type: "ADMIN" | "TECHNIQUE" | "FINANCIER" | "RH";
  obligatoire: boolean;
  langue: string;
  responsable: string;
  deadline_interne: string;
  statut: string; // PENDING / EN_COURS / OK / NOK
  source_section: string;
  note: string;
}

export interface RequiredProfile {
  profil: string;
  domaine: string;
  quantite: number;
  niveau: string;
  experience_min: string;
  competences: string[];
  certifications: string[];
  missions: string[];
  rattachement: string;
  source_section: string;
}

export interface EligibilityThreshold {
  libelle: string;
  valeur: string;
  unite: string;
  type: "FINANCIER" | "EXPERIENCE" | "REFERENCES" | "ADMIN" | "AUTRE";
  blocking: boolean;
  source_section: string;
}

export interface FinancialData {
  budget_estime: string;
  modalites_paiement: string;
  garantie_soumission: string;
  penalites: string;
  source_section: string;
}

/** Exigence textuelle extraite de l'AO, avec sa référence source. */
export interface ExtractedItem {
  texte: string;
  source_section?: string;
}

/** Texte d'une exigence — tolère l'ancien format `string` (cache) comme le nouveau. */
export function itemText(x: string | ExtractedItem | null | undefined): string {
  if (x == null) return "";
  return typeof x === "string" ? x : (x.texte ?? "");
}

export interface ScoringResult {
  ao_filename: string;
  summary: string;
  key_elements: { category: string; value: string }[];
  matched_documents: { doc_id: string; filename: string; doc_type: string; relevance_score: number; excerpt: string }[];
  gaps_analysis: string;
  strengths: string[];
  risks: Risk[];
  score: number;
  score_basis?: "GRILLE" | "ESTIME" | "INDISPONIBLE";
  recommendation: "GO" | "NO_BID" | "CONDITIONAL";
  justification: string;
  criteres_selection?: ExtractedItem[];
  besoins?: ExtractedItem[];
  prerequis?: ExtractedItem[];
  ressources_demandees?: ExtractedItem[];
  points_vigilance?: ExtractedItem[];
  date_remise?: string;
  team_matches?: { doc_id: string; filename: string; doc_type: string; relevance_score: number; excerpt: string }[];
  similar_projects?: { doc_id: string; filename: string; doc_type: string; relevance_score: number; excerpt: string }[];
  market_identity?: MarketIdentity;
  calendar?: CalendarEvent[];
  evaluation_modalities?: EvaluationModalities;
  criteria_breakdown?: ScoringCriterion[];
  preconditions?: Precondition[];
  preconditions_incomplete?: boolean;
  appendices?: Appendix[];
  appendices_incomplete?: boolean;
  profils_demandes?: RequiredProfile[];
  seuils_eligibilite?: EligibilityThreshold[];
  donnees_financieres?: FinancialData;
}

export interface Partner {
  name: string;
  role: string; // chef_de_file / membre_groupement / sous_traitant
  type: string; // entreprise / consortium
}

export interface PhaseAction {
  day_label: string;
  action: string;
  responsable: string;
  duree_estimee: string;
  deliverable: string;
  statut: string;
}

export interface StrategyPhase {
  id: string;
  name: string;
  description: string;
  start_day: string;
  end_day: string;
  actions: PhaseAction[];
  prerequisites: string[];
  is_blocking_next: boolean;
}

export interface BidStrategy {
  phases: StrategyPhase[];
  strategy_text: string;
  response_plan: string;
  appendices: Appendix[];
  partner: Partner | null;
  partner_validation: Precondition[];
  version: number;
  parent_version: number | null;
  generated_at: string;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export async function scoreAO(file: File, force = false): Promise<ScoringResult> {
  const formData = new FormData();
  formData.append("file", file);

  // force=true : ignore le cache disque (par hash du fichier) et relance une analyse complète.
  const url = `${API_BASE}/presales/score${force ? "?force=true" : ""}`;
  let response: Response;
  try {
    // Pas de timeout client : le pipeline (~2-10 min) est streamé en heartbeat par le serveur.
    response = await fetch(url, { method: "POST", body: formData });
  } catch (e) {
    const name = (e != null && typeof e === "object" && "name" in e) ? (e as { name: unknown }).name : "";
    const msg = String(e instanceof Error ? e.message : e);
    if (name === "AbortError" || msg.toLowerCase().includes("abort")) {
      throw new Error("Analyse annulée — connexion interrompue.");
    }
    throw new Error("Serveur inaccessible — vérifiez que le backend est démarré.");
  }

  if (response.status === 401) {
    window.location.replace("/");
    throw new Error("Session expirée — reconnexion en cours…");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as Record<string, string>;
    throw new Error((error as { detail?: string }).detail ?? `Erreur serveur ${response.status}`);
  }

  // Réponse streamée (heartbeat) : le flux démarre par un 200, donc une erreur du pipeline
  // arrive dans le corps via la sentinelle { __error__: <status>, detail }. Les espaces de
  // heartbeat en tête sont ignorés par JSON.parse.
  const data = await response.json() as ScoringResult & { __error__?: number; detail?: string };
  if (data && typeof data.__error__ === "number") {
    throw new Error(data.detail ?? `Erreur serveur ${data.__error__}`);
  }
  return data as ScoringResult;
}

// ── Dossiers persistés (fichier + état complet du workflow) ──────────────────
//
// Avant : le fichier AO et tout l'état du workflow ne vivaient qu'en mémoire
// navigateur (localStorage + File en RAM) → après un rechargement de page,
// « refaire une étape » échouait faute de fichier. Le backend persiste
// désormais le fichier ET l'état complet — ces fonctions remplacent
// localStorage comme source de vérité. `state` est volontairement `unknown` /
// générique côté API : c'est PresalesWorkflow.tsx qui connaît la forme AOEntry.

/** Crée un dossier persisté : upload du fichier + état initial (AOEntry). */
export async function createDossier(
  dossierId: string, file: File, initialState: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("file", file);
  form.append("dossier_id", dossierId);
  form.append("state", JSON.stringify(initialState));
  const r = await apiFetch(`${API_BASE}/presales/dossiers`, { method: "POST", body: form }, 60_000);
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { detail?: string };
    throw new Error(e.detail ?? `Erreur création du dossier (${r.status})`);
  }
  return r.json();
}

/** Historique complet des dossiers présale (remplace localStorage au chargement). */
export async function listDossiers(): Promise<Record<string, unknown>[]> {
  const r = await apiFetch(`${API_BASE}/presales/dossiers`, {}, 30_000);
  if (!r.ok) throw new Error(`Erreur chargement des dossiers (${r.status})`);
  return r.json();
}

/** Fusionne un patch partiel (mêmes clés que l'objet AOEntry) dans l'état persisté. */
export async function patchDossier(
  dossierId: string, changes: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const r = await apiFetch(`${API_BASE}/presales/dossiers/${dossierId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }, 30_000);
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { detail?: string };
    throw new Error(e.detail ?? `Erreur mise à jour du dossier (${r.status})`);
  }
  return r.json();
}

/** Télécharge le fichier AO original tel qu'uploadé (bouton téléchargement de l'historique). */
export async function downloadDossierFile(dossierId: string): Promise<Blob> {
  const r = await apiFetch(`${API_BASE}/presales/dossiers/${dossierId}/file`, {}, 60_000);
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { detail?: string };
    throw new Error(e.detail ?? `Erreur téléchargement du fichier (${r.status})`);
  }
  return r.blob();
}

/** Supprime un dossier (base + fichier serveur). */
export async function deleteDossier(dossierId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/presales/dossiers/${dossierId}`, { method: "DELETE" }, 30_000);
  if (!r.ok && r.status !== 404) throw new Error(`Erreur suppression du dossier (${r.status})`);
}

/** (Re)lance le scoring sur le fichier PERSISTÉ du dossier — plus besoin de File en mémoire. */
export async function analyzeDossier(dossierId: string, force = false): Promise<ScoringResult> {
  const url = `${API_BASE}/presales/dossiers/${dossierId}/analyze${force ? "?force=true" : ""}`;
  let response: Response;
  try {
    response = await fetch(url, { method: "POST" });
  } catch (e) {
    const name = (e != null && typeof e === "object" && "name" in e) ? (e as { name: unknown }).name : "";
    const msg = String(e instanceof Error ? e.message : e);
    if (name === "AbortError" || msg.toLowerCase().includes("abort")) {
      throw new Error("Analyse annulée — connexion interrompue.");
    }
    throw new Error("Serveur inaccessible — vérifiez que le backend est démarré.");
  }
  if (response.status === 401) {
    window.location.replace("/");
    throw new Error("Session expirée — reconnexion en cours…");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as Record<string, string>;
    throw new Error((error as { detail?: string }).detail ?? `Erreur serveur ${response.status}`);
  }
  const data = await response.json() as ScoringResult & { __error__?: number; detail?: string };
  if (data && typeof data.__error__ === "number") {
    throw new Error(data.detail ?? `Erreur serveur ${data.__error__}`);
  }
  return data as ScoringResult;
}

// ── Matrice de conformité ─────────────────────────────────────────────────────

export interface ConformityExigence {
  id: string;
  texte: string;
  type: string;
  source_ref: string;
  origine: string;
  domaines_suggeres: string[];
  domaine_valide: string;
  confidence: number;
  section_reponse: string;
  statut_conformite: string; // statut VALIDÉ par l'humain (A_TRAITER tant que non coché)
  blocking: boolean;
  commentaire: string;
  statut_suggere: string; // proposition IA
  justification_ia: string;
  confiance_ia: number;
  preuve_ref: string;
  confirme: boolean;
  confirme_par: string;
  confirme_le: string;
}

export interface ConformityMatrix {
  ao_filename: string;
  exigences: ConformityExigence[];
  generated_at: string;
  expected_total: number | null;
}

export interface MatrixConfirmation {
  id: string;
  statut_confirme?: string;
  domaine_valide?: string;
  commentaire?: string;
  confirme?: boolean;
}

/** Construit la matrice + pré-statut IA (déterministe) et la persiste. */
export async function assessMatrix(scoring: ScoringResult, clientName = ""): Promise<ConformityMatrix> {
  const r = await apiFetch(`${API_BASE}/presales/matrix/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scoring_result: scoring, client_name: clientName }),
  }, 120_000);
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { detail?: string };
    throw new Error(e.detail ?? `Erreur analyse conformité (${r.status})`);
  }
  return r.json() as Promise<ConformityMatrix>;
}

/** Applique les cochages humains de confirmation et re-persiste. */
export async function confirmMatrix(
  aoFilename: string, confirmations: MatrixConfirmation[], confirmePar = "",
): Promise<{ ao_filename: string; total: number; confirmes: number; par_statut_valide: Record<string, number>; exigences: ConformityExigence[] }> {
  const r = await apiFetch(`${API_BASE}/presales/matrix/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ao_filename: aoFilename, confirme_par: confirmePar, confirmations }),
  }, 60_000);
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { detail?: string };
    throw new Error(e.detail ?? `Erreur confirmation conformité (${r.status})`);
  }
  return r.json();
}

// ── GED (lecture + upload, pour le workflow AO) ──────────────────────────────

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
  const r = await apiFetch(`${API_BASE}/ged/upload`, { method: "POST", body: form }, 120_000);
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Upload error: ${r.status}`);
  }
  return r.json();
}

// ── Stratégie de réponse ──────────────────────────────────────────────────────

export async function generateBidStrategy(
  scoringResult: ScoringResult,
  decision: string,
  clientName?: string,
  decisionReason?: string,
  partner?: Partner | null,
): Promise<BidStrategy> {
  const response = await apiFetch(`${API_BASE}/presales/bid-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scoring_result: scoringResult,
      client_name: clientName,
      decision,
      decision_reason: decisionReason,
      partner: partner ?? null,
    }),
  }, 240_000); // 4 min : la stratégie Sonnet (8000 tokens) prend ~90-145s, +marge contention sync Odoo
  if (!response.ok) throw new Error(`Strategy error: ${response.status}`);
  return response.json();
}

// ── Exports Word ──────────────────────────────────────────────────────────────

export async function exportAnalysis(scoringResult: ScoringResult, clientName?: string): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/export-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scoring_result: scoringResult, client_name: clientName }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export error: ${response.status}`);
  return response.blob();
}

export async function exportMatrix(scoringResult: ScoringResult, clientName?: string): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/export-matrix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scoring_result: scoringResult, client_name: clientName }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export matrix error: ${response.status}`);
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
  bidStrategy: BidStrategy,
  clientName?: string,
  decision?: string,
): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/export-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scoring_result: scoringResult,
      bid_strategy: bidStrategy,
      client_name: clientName,
      decision: decision ?? "GO",
    }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export stratégie error: ${response.status}`);
  return response.blob();
}

export async function exportChecklist(
  aoFilename: string,
  appendices: Appendix[],
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
      appendices,
    }),
  }, 60_000);
  if (!response.ok) throw new Error(`Export checklist error: ${response.status}`);
  return response.blob();
}

// ── Génération d'offre ────────────────────────────────────────────────────────

// Plan de document produit par l'IA (plus de gabarit) : couverture + blocs typés.
// Le builder backend met ces blocs en forme dans le .docx. Cf. offer_docx_builder.py.
export interface OfferCover {
  titre: string;
  sous_titre?: string;
  accroche?: string;
}

export type OfferBlockType =
  | "heading" | "paragraph" | "bullets" | "numbered" | "table" | "page_break";

export interface OfferBlock {
  type: OfferBlockType;
  level?: number;          // heading
  text?: string;           // heading / paragraph
  items?: string[];        // bullets / numbered
  titre?: string;          // table
  headers?: string[];      // table
  rows?: string[][];       // table
}

export interface OfferSections {
  cover: OfferCover;
  blocks: OfferBlock[];
}

export interface OfferSectionsResponse {
  sections: OfferSections;
  domain: string;
  client_name: string;
  filename: string;
}

/** Étape 1 : génère (IA) les sections éditables de l'offre, sans produire le .docx. */
export async function buildOfferSections(scoringResult: ScoringResult, clientName?: string): Promise<OfferSectionsResponse> {
  const response = await apiFetch(`${API_BASE}/presales/offer/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ao_filename: scoringResult.ao_filename,
      scoring_result: scoringResult,
      client_name: clientName,
    }),
  }, 180_000);
  if (!response.ok) throw new Error(`Offer sections error: ${response.status}`);
  return response.json();
}

/** Étape 2 : produit le .docx à partir des sections (éventuellement éditées).
 *  `selectedCvs` / `selectedAbes` : noms de fichiers GED choisis dans le modal —
 *  les CV alimentent le tableau équipe, les ABE une section « Références ». */
export async function renderOffer(
  scoringResult: ScoringResult,
  sections: OfferSections,
  clientName?: string,
  selectedCvs: string[] = [],
  selectedAbes: string[] = [],
): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/presales/offer/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ao_filename: scoringResult.ao_filename,
      scoring_result: scoringResult,
      sections,
      client_name: clientName,
      selected_cvs: selectedCvs,
      selected_abes: selectedAbes,
    }),
  }, 180_000); // marge : l'intégration en annexe des pages PDF des CV/ABE prend du temps
  if (!response.ok) throw new Error(`Offer render error: ${response.status}`);
  return response.blob();
}
