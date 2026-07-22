"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BACKEND_URL, TOKEN_COOKIE } from "@/lib/backend";
import { ROLE_COOKIE } from "@/lib/session";
import { PROFILES } from "@/lib/fixtures/profiles";
import { firstAllowedFrom } from "@/lib/navigation";
import type { Role } from "@/lib/types";

const VALID = new Set<Role>(PROFILES.map((p) => p.role));

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 8, // 8 h
} as const;

interface LoginApiResponse {
  access_token: string;
  user: { role: string; allowed_views: string[] | null };
}

export type LoginResult =
  /** `home` = première vue autorisée (matrice dynamique du backend) */
  | { ok: true; role: Role; home: string }
  | { ok: false; error: string };

const BACKEND_DOWN =
  "backend injoignable — démarrez l'API FastAPI (port 8000) puis réessayez";

/** Appelle POST /v1/auth/login. null = backend injoignable. */
async function callLogin(email: string, password: string): Promise<Response | null> {
  try {
    return await fetch(`${BACKEND_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      cache: "no-store",
    });
  } catch {
    return null; // backend éteint / injoignable
  }
}

async function loginResultFrom(res: Response | null): Promise<LoginResult> {
  if (res === null) return { ok: false, error: BACKEND_DOWN };
  if (!res.ok) {
    let detail = `erreur ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // corps non-JSON
    }
    return { ok: false, error: detail };
  }
  const data = (await res.json()) as LoginApiResponse;
  const role = data.user.role as Role;
  if (!VALID.has(role)) {
    return { ok: false, error: `rôle « ${data.user.role} » non pris en charge par le cockpit` };
  }
  return { ok: true, role, home: firstAllowedFrom(data.user.allowed_views) };
}

/**
 * Étape 1 — vérifie les identifiants SANS poser de cookie (pas de refresh
 * du routeur → la modale « Sales IA vous attend » peut s'afficher).
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<LoginResult> {
  return loginResultFrom(await callLogin(email, password));
}

/**
 * Étape 2 — connexion effective : re-vérifie les identifiants et pose les
 * cookies httpOnly (JWT + rôle). Le JWT n'est jamais exposé au navigateur.
 * Aucun mode démo : sans backend, pas de session.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await callLogin(email, password);
  if (res === null || !res.ok) return loginResultFrom(res);

  const data = (await res.json()) as LoginApiResponse;
  const role = data.user.role as Role;
  if (!VALID.has(role)) {
    return { ok: false, error: `rôle « ${data.user.role} » non pris en charge par le cockpit` };
  }

  const store = await cookies();
  store.set(TOKEN_COOKIE, data.access_token, COOKIE_OPTS);
  store.set(ROLE_COOKIE, role, COOKIE_OPTS);
  return { ok: true, role, home: firstAllowedFrom(data.user.allowed_views) };
}

/** Déconnexion : purge les cookies de session et revient à l'écran de connexion. */
export async function logout() {
  const store = await cookies();
  store.delete(ROLE_COOKIE);
  store.delete(TOKEN_COOKIE);
  // Session de conversation Sales IA — repartir propre à la prochaine connexion.
  store.delete("np_copilot_session");
  redirect("/");
}

// ---------- Administration des utilisateurs (admin uniquement, gating serveur) ----------

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export interface CreateUserInput {
  email: string;
  full_name: string;
  role: Role;
  password: string;
}

export interface UpdateUserInput {
  email?: string;
  full_name?: string;
  role?: Role;
  is_active?: boolean;
  password?: string;
}

async function adminCall(
  path: string,
  method: string,
  body?: unknown,
): Promise<AdminActionResult> {
  // Import locaux pour ne pas alourdir le module partagé avec le login
  const { backendFetch, BackendError } = await import("@/lib/backend");
  const { revalidatePath } = await import("next/cache");
  try {
    await backendFetch(path, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (e instanceof BackendError) {
      // Session périmée ou rôle du compte modifié depuis la connexion :
      // le backend re-vérifie le rôle RÉEL en base à chaque appel.
      if (e.status === 401 || e.status === 403) {
        return {
          ok: false,
          error: `${e.message} — votre session ne correspond plus à un compte admin actif : déconnectez-vous (« Changer de profil ») puis reconnectez-vous avec un compte admin`,
        };
      }
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "backend injoignable" };
  }
}

/** Crée un utilisateur — le backend re-vérifie que l'appelant est admin. */
export async function createUserAction(input: CreateUserInput): Promise<AdminActionResult> {
  return adminCall("/v1/auth/users", "POST", input);
}

/** Modifie un utilisateur (nom, email, rôle, statut, mot de passe). */
export async function updateUserAction(
  userId: number,
  input: UpdateUserInput,
): Promise<AdminActionResult> {
  return adminCall(`/v1/auth/users/${userId}`, "PATCH", input);
}

/** Supprime définitivement un utilisateur (garde-fous côté backend). */
export async function deleteUserAction(userId: number): Promise<AdminActionResult> {
  return adminCall(`/v1/auth/users/${userId}`, "DELETE");
}

/**
 * Modifie une cellule de la matrice rôles × modules (admin uniquement).
 * Persistée côté backend (table module_permissions) et appliquée dès la
 * requête suivante — sidebar, gating de routes et endpoints API.
 */
export async function updatePermissionAction(
  view: string,
  role: Role,
  allowed: boolean,
): Promise<AdminActionResult> {
  return adminCall("/v1/auth/permissions", "PATCH", { view, role, allowed });
}

/** Supprime toutes les surcharges → retour à la matrice par défaut du code. */
export async function resetPermissionsAction(): Promise<AdminActionResult> {
  return adminCall("/v1/auth/permissions/reset", "POST");
}

// ---------- Forecast : analyse IA à la demande (POST déclenché par clic) ----------

export type ForecastAnalysisActionResult =
  | { ok: true; analysis: string }
  | { ok: false; error: string };

interface ForecastAnalysisResponse {
  analysis: string;
}

/**
 * Rédige la lecture qualitative du forecast pondéré (Claude, sur les vraies
 * opportunités du pipeline). Appelé à la demande depuis ForecastLive — jamais
 * au chargement de la page, pour ne pas payer un appel LLM à chaque visite.
 */
export async function generateForecastAnalysisAction(): Promise<ForecastAnalysisActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const data = await backendFetch<ForecastAnalysisResponse>(
      "/v1/dashboard/forecast/analysis",
      { method: "POST" },
    );
    return { ok: true, analysis: data.analysis };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

export interface ClientDecisionResult {
  decision_key: string;
  decision_label: string;
  justification: string;
  action: string;
  ai_generated: boolean;
}

export type ClientDecisionActionResult =
  | { ok: true; decision: ClientDecisionResult }
  | { ok: false; error: string };

/**
 * Décision recommandée pour un client du forecast : le risque (impayé connu +
 * échéance dépassée) est calculé côté backend par une règle déterministe —
 * Claude ne rédige que la justification et l'action, jamais la décision.
 */
export async function generateClientDecisionAction(
  client: string,
): Promise<ClientDecisionActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const decision = await backendFetch<ClientDecisionResult>(
      "/v1/dashboard/forecast/client-decision",
      { method: "POST", body: JSON.stringify({ client }) },
    );
    return { ok: true, decision };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

// ---------- Dashboard : projection IA à la demande ----------

export type DashboardAnalysisActionResult =
  | { ok: true; analysis: string }
  | { ok: false; error: string };

interface DashboardAnalysisResponse {
  analysis: string;
}

/** Projection & recommandation du cockpit (Claude, sur les KPIs réels). */
export async function generateDashboardAnalysisAction(): Promise<DashboardAnalysisActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const data = await backendFetch<DashboardAnalysisResponse>("/v1/dashboard/analysis", {
      method: "POST",
    });
    return { ok: true, analysis: data.analysis };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

// ---------- Montée en valeur : analyse transversale IA à la demande ----------

export type CrossSellAnalysisActionResult =
  | { ok: true; analysis: string }
  | { ok: false; error: string };

interface CrossSellAnalysisResponse {
  analysis: string;
}

/** Priorisation transversale des signaux de montée en valeur (Claude, sur commandes réelles). */
export async function generateCrossSellAnalysisAction(): Promise<CrossSellAnalysisActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const data = await backendFetch<CrossSellAnalysisResponse>("/v1/crosssell/analysis", {
      method: "POST",
    });
    return { ok: true, analysis: data.analysis };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

// ---------- Portefeuille clients : dossiers + profil IA à la demande ----------

export interface ClientDossierRow {
  ref: string;
  client: string;
  projet: string;
  commercial: string;
  etat: string;
  date_creation: string | null;
  date_fin: string | null;
  ca_provisoire: number;
  ca_definitif: number;
  marge_provisoire: number;
  marge_definitive: number;
  perc_marge_provisoire: number;
  perc_marge_definitive: number;
  montant_recu: number;
  reste_a_encaisser: number;
  backlog: number;
}

export type ClientDossiersActionResult =
  | { ok: true; dossiers: ClientDossierRow[] }
  | { ok: false; error: string };

/** Historique réel des dossiers d'un client (table dossiers). */
export async function fetchClientDossiersAction(client: string): Promise<ClientDossiersActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const dossiers = await backendFetch<ClientDossierRow[]>(
      `/v1/clients/dossiers?client=${encodeURIComponent(client)}`,
    );
    return { ok: true, dossiers };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

export interface ClientProfileResult {
  activite: string;
  recommandations: string[];
  ai_generated: boolean;
}

export type ClientProfileActionResult =
  | { ok: true; profile: ClientProfileResult }
  | { ok: false; error: string };

/**
 * Rédige l'activité + les recommandations d'un client à partir de ses vrais
 * dossiers — le backend calcule les constats, Claude ne fait que les rédiger.
 */
export async function generateClientProfileAction(client: string): Promise<ClientProfileActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const profile = await backendFetch<ClientProfileResult>("/v1/clients/profile", {
      method: "POST",
      body: JSON.stringify({ client }),
    });
    return { ok: true, profile };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

// ---------- Fournisseurs : analyse IA à la demande ----------

export type PartnersAnalysisActionResult =
  | { ok: true; analysis: string }
  | { ok: false; error: string };

interface PartnersAnalysisResponse {
  analysis: string;
}

/** Analyse de concentration fournisseurs (Claude, sur les vraies commandes d'achat). */
export async function generatePartnersAnalysisAction(): Promise<PartnersAnalysisActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const data = await backendFetch<PartnersAnalysisResponse>("/v1/partners/analysis", {
      method: "POST",
    });
    return { ok: true, analysis: data.analysis };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

// ---------- Performance : analyse IA à la demande ----------

export type PerformanceAnalysisActionResult =
  | { ok: true; analysis: string }
  | { ok: false; error: string };

interface PerformanceAnalysisResponse {
  analysis: string;
}

/** Lecture qualitative des performances (Claude, sur taux de victoire + pertes réelles). */
export async function generatePerformanceAnalysisAction(): Promise<PerformanceAnalysisActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const data = await backendFetch<PerformanceAnalysisResponse>(
      "/v1/dashboard/performance/analysis",
      { method: "POST" },
    );
    return { ok: true, analysis: data.analysis };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

// ---------- Trésorerie : analyse IA + décision de recouvrement à la demande ----------

export type TresorerieAnalysisActionResult =
  | { ok: true; analysis: string }
  | { ok: false; error: string };

interface TresorerieAnalysisResponse {
  analysis: string;
}

/** Lecture qualitative de l'exposition aux impayés (Claude, sur données réelles). */
export async function generateTresorerieAnalysisAction(): Promise<TresorerieAnalysisActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const data = await backendFetch<TresorerieAnalysisResponse>(
      "/v1/dashboard/unpaid/analysis",
      { method: "POST" },
    );
    return { ok: true, analysis: data.analysis };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

export interface RecouvrementDecisionResult {
  decision_key: string;
  decision_label: string;
  justification: string;
  action: string;
  ai_generated: boolean;
}

export type RecouvrementDecisionActionResult =
  | { ok: true; decision: RecouvrementDecisionResult }
  | { ok: false; error: string };

/**
 * Décision de recouvrement pour un débiteur : l'urgence (retard réel) est
 * calculée côté backend par une règle déterministe — Claude ne rédige que la
 * justification et l'action, jamais le niveau d'urgence.
 */
export async function generateRecouvrementDecisionAction(
  client: string,
): Promise<RecouvrementDecisionActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const decision = await backendFetch<RecouvrementDecisionResult>(
      "/v1/dashboard/unpaid/recouvrement-decision",
      { method: "POST", body: JSON.stringify({ client }) },
    );
    return { ok: true, decision };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}

// ---------- Briefing quotidien : lecture à la demande (modal du Dashboard) ----------

export type BriefingActionResult =
  | { ok: true; data: import("@/lib/api/briefing").BriefingData }
  | { ok: false; error: string };

/** Lit le briefing figé du rôle courant (GET /v1/briefing) — chargé à la demande. */
export async function fetchBriefingAction(): Promise<BriefingActionResult> {
  const { backendFetch, BackendError } = await import("@/lib/backend");
  try {
    const data = await backendFetch<import("@/lib/api/briefing").BriefingData>("/v1/briefing");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.message };
    return { ok: false, error: "backend injoignable" };
  }
}
