import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/dashboard/performance/summary ----------

export interface WinRate {
  gagnees_nb: number;
  perdues_nb: number;
  taux_nb_pct: number;
  gagnees_valeur_xof: number;
  perdues_valeur_xof: number;
  taux_valeur_pct: number;
}

export interface LostDeal {
  name: string;
  client: string;
  montant_xof: number;
  commercial: string;
}

export interface LostByClient {
  client: string;
  nb: number;
  montant_xof: number;
}

export interface LostByCommercial {
  commercial: string;
  nb: number;
  montant_xof: number;
}

export interface LostDeals {
  nb_total: number;
  montant_total_xof: number;
  top_deals: LostDeal[];
  by_client: LostByClient[];
  by_commercial: LostByCommercial[];
}

export interface PerformanceSummary {
  win_rate: WinRate;
  lost_deals: LostDeals;
}

/** Performances réelles (taux de victoire + pertes). Lève si le backend est indisponible. */
export async function fetchPerformanceSummary(): Promise<PerformanceSummary> {
  return backendFetch<PerformanceSummary>("/v1/dashboard/performance/summary");
}
