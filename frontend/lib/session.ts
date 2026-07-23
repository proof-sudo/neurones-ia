import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "./types";
import { PROFILES } from "./fixtures/profiles";
import { firstAllowedFrom, getAllowedViews } from "./navigation";
import { BACKEND_URL, getBackendToken } from "./backend";

export const ROLE_COOKIE = "np_role";

const VALID_ROLES = new Set<Role>(PROFILES.map((p) => p.role));

function isRole(value: string | undefined): value is Role {
  return !!value && VALID_ROLES.has(value as Role);
}

/** Session courante : rôle + vues autorisées (null = accès total, admin). */
export interface Session {
  role: Role;
  allowedViews: string[] | null;
  fullName: string;
  email: string;
}

/**
 * Session courante (null si non connecté).
 *
 * Source de vérité = le BACKEND (GET /v1/auth/me) : rôle ET vues autorisées.
 * La matrice module × rôle étant dynamique (éditable depuis l'écran
 * Administration), `allowed_views` reflète les droits réellement appliqués
 * par le serveur — si un admin change un droit, les menus et accès sont mis
 * à jour dès la prochaine navigation, sans reconnexion. Le cookie np_role +
 * la matrice statique ne servent que de repli si le backend est
 * momentanément injoignable en cours de session. Token expiré ou compte
 * désactivé → session invalide (retour connexion).
 *
 * `cache()` déduplique l'appel au sein d'un même rendu (layout + page).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = await getBackendToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null; // token expiré / compte désactivé → reconnexion
    const me = (await res.json()) as {
      role?: string; allowed_views?: string[] | null; full_name?: string; email?: string;
    };
    if (!isRole(me.role)) return null;
    // allowed_views absent (backend antérieur) → repli matrice statique
    const views =
      me.allowed_views !== undefined ? me.allowed_views : staticViews(me.role);
    return { role: me.role, allowedViews: views, fullName: me.full_name ?? "", email: me.email ?? "" };
  } catch {
    // Backend momentanément injoignable : repli sur le rôle posé à la connexion
    const store = await cookies();
    const value = store.get(ROLE_COOKIE)?.value;
    if (!isRole(value)) return null;
    return { role: value, allowedViews: staticViews(value), fullName: "", email: "" };
  }
});

function staticViews(role: Role): string[] | null {
  const allowed = getAllowedViews(role);
  return allowed ? [...allowed] : null;
}

/** Rôle courant de la session (null si non connecté). */
export const getCurrentRole = async (): Promise<Role | null> =>
  (await getSession())?.role ?? null;

/**
 * Garde d'accès à utiliser en tête de chaque page de vue : redirige vers
 * l'écran de connexion si non connecté, ou vers la 1re vue autorisée si le
 * rôle n'a pas le droit d'accéder à cette vue (contrôle côté serveur — pas
 * seulement un filtrage cosmétique de menu).
 */
export async function requireView(view: string): Promise<Role> {
  const session = await getSession();
  if (!session) redirect("/");
  const { role, allowedViews } = session;
  if (allowedViews !== null && !allowedViews.includes(view)) {
    redirect(`/${firstAllowedFrom(allowedViews)}`);
  }
  return role;
}
