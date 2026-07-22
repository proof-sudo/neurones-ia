import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/crosssell/signals ----------

export interface ValeurSignal {
  client: string;
  titre: string;
  detail: string;
  montant_xof: number;
  age_mois?: number;
}

export interface MonteeValeurSignals {
  renouvellement: ValeurSignal[];
  obsolete: ValeurSignal[];
  cross_sell: ValeurSignal[];
  up_sell: ValeurSignal[];
}

/** Signaux réels de montée en valeur (sur les vraies commandes). Lève si le backend est indisponible. */
export async function fetchCrossSellSignals(): Promise<MonteeValeurSignals> {
  return backendFetch<MonteeValeurSignals>("/v1/crosssell/signals");
}
