import "server-only";

import { cookies } from "next/headers";

/**
 * Accès serveur → FastAPI. Le JWT vit dans un cookie httpOnly (np_token)
 * et n'est JAMAIS exposé au navigateur : tous les appels backend partent
 * des Server Components / Route Handlers / Server Actions de Next.
 */
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export const TOKEN_COOKIE = "np_token";

export async function getBackendToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(TOKEN_COOKIE)?.value ?? null;
}

export class BackendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * fetch authentifié vers le backend. Lève BackendError sur réponse non-2xx,
 * et laisse remonter les erreurs réseau (backend éteint) — l'appelant décide
 * du repli (fixtures + bandeau démo).
 */
export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getBackendToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    // Données métier fraîches à chaque requête (pas de cache Next)
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // corps non-JSON — on garde statusText
    }
    throw new BackendError(res.status, detail);
  }
  return (await res.json()) as T;
}
