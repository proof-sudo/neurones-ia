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
  premiere_commande: string | null;
  montant_moyen_xof: number;
  montant_engage_12m_xof: number;
  nb_commandes_12m: number;
  commandes_recentes: SupplierOrder[];
}

/** Fournisseurs réels (purchase_orders). Lève si le backend est indisponible. */
export async function fetchTopSuppliers(limit = 20): Promise<Supplier[]> {
  return backendFetch<Supplier[]>(`/v1/partners/top?limit=${limit}`);
}
