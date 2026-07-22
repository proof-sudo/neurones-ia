import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/dashboard/unpaid ----------

export interface TopDebiteur {
  client: string;
  nb_factures: number;
  montant_total_xof: number;
  retard_max_jours: number;
}

export interface UnpaidExposure {
  exposition_totale_xof: number;
  nb_factures_impayees: number;
  par_statut: Record<string, { nb: number; montant: number }>;
  retard_90j_nb_factures: number;
  retard_90j_montant_xof: number;
  top_10_debiteurs: TopDebiteur[];
}

export interface UnpaidInvoice {
  client: string;
  montant_xof: number;
  "échéance": string;
  statut: string;
}

export interface UnpaidData {
  exposure: UnpaidExposure;
  top_invoices: UnpaidInvoice[];
}

/** Exposition réelle aux impayés. Lève si le backend est indisponible. */
export async function fetchUnpaidData(): Promise<UnpaidData> {
  return backendFetch<UnpaidData>("/v1/dashboard/unpaid");
}
