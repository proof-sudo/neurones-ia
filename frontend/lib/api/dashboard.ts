import "server-only";

import { backendFetch } from "../backend";

// ---------- Types des réponses /v1/dashboard/* (formes du LocalCRMAdapter) ----------

export interface YearStats {
  year: number;
  clients_with_orders: number;
  orders_count: number;
  revenue_xof: number;
}

export interface MonthPoint {
  mois: number;
  ca_xof: number;
  nb_commandes: number;
}

export interface OpenPipelineStage {
  stade: string;
  nb: number;
  ca_brut_xof: number;
  ca_pondere_xof: number;
}

export interface OpenPipeline {
  total_opportunites: number;
  ca_brut_xof: number;
  ca_pondere_xof: number;
  plus_un_an_nb: number;
  plus_un_an_pct: number;
  par_stade: OpenPipelineStage[];
}

export interface WinRate {
  gagnees_nb: number;
  perdues_nb: number;
  taux_nb_pct: number;
  gagnees_valeur_xof: number;
  perdues_valeur_xof: number;
  taux_valeur_pct: number;
}

export interface DashboardKpis {
  year: YearStats;
  previous_year: YearStats;
  monthly: MonthPoint[];
  monthly_previous: MonthPoint[];
  open_pipeline: OpenPipeline;
  win_rate: WinRate;
  marges: {
    nb_dossiers: number;
    perc_marge_provisoire_moyen: number;
    perc_marge_definitive_moyen: number;
    backlog_total: number;
    reste_a_encaisser: number;
    total_encaisse: number;
    ca_definitif_total: number;
    marge_definitive_total: number;
    fournisseurs_restant: number;
  };
}

export interface CountryClients {
  pays: string;
  nb_clients: number;
}

export interface SalespersonRevenue {
  commercial: string;
  ca_total_xof: number;
  nb_commandes: number;
  nb_clients_distincts: number;
  panier_moyen_xof: number;
}

export interface TopClientRow {
  client: string;
  nb_commandes: number;
  ca_total_xof: number;
  pays: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  byCountry: CountryClients[];
  bySalesperson: SalespersonRevenue[];
  topClients: TopClientRow[];
}

/** Charge tous les blocs du dashboard en parallèle. Lève si le backend est indisponible. */
export async function fetchDashboardData(): Promise<DashboardData> {
  const [kpis, byCountry, bySalesperson, topClients] = await Promise.all([
    backendFetch<DashboardKpis>("/v1/dashboard/kpis"),
    backendFetch<CountryClients[]>("/v1/dashboard/clients-by-country"),
    backendFetch<SalespersonRevenue[]>("/v1/dashboard/revenue/by-salesperson"),
    backendFetch<TopClientRow[]>("/v1/dashboard/top-clients"),
  ]);
  return { kpis, byCountry, bySalesperson, topClients };
}
