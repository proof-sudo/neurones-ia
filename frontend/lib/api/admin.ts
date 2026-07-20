import "server-only";

import { backendFetch } from "@/lib/backend";

/** Utilisateur tel que renvoyé par GET /v1/auth/users (admin uniquement). */
export interface BackendUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
}

export function fetchUsers(): Promise<BackendUser[]> {
  return backendFetch<BackendUser[]>("/v1/auth/users");
}

/** Matrice effective module × rôle telle qu'appliquée par le serveur. */
export interface BackendPermissions {
  roles: string[];
  views: string[];
  matrix: Record<string, Record<string, boolean>>;
}

export function fetchPermissions(): Promise<BackendPermissions> {
  return backendFetch<BackendPermissions>("/v1/auth/permissions");
}
