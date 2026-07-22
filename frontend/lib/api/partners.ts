import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/partners/top ----------

export interface SupplierOrder {
  ref: string;
  montant_xof: number;
  date: string | null;
}

export interface Supplier {
  name: string;
  montant_total_xof: number;
  nb_commandes: number;
  derniere_commande: string | null;
  commandes_recentes: SupplierOrder[];
}

/** Fournisseurs réels (purchase_orders). Lève si le backend est indisponible. */
export async function fetchTopSuppliers(limit = 20): Promise<Supplier[]> {
  return backendFetch<Supplier[]>(`/v1/partners/top?limit=${limit}`);
}
