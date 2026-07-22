import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/dashboard/forecast/pipeline-weighted ----------

export interface ForecastOpportunity {
  name: string;
  client: string;
  stage: string;
  value_xof: number;
  probability_pct: number;
  commercial: string;
  deadline: string | null;
  created_at: string | null;
  age_days: number | null;
  month_offset: number;
  at_risk: boolean;
  weighted_xof: number;
}

export interface ForecastScenarios {
  realiste_xof: number;
  pessimiste_xof: number;
  optimiste_xof: number;
  total_pipeline_xof: number;
  avg_probability_pct: number;
  nb_opportunites: number;
}

export interface ForecastMonthlyBuckets {
  realiste_xof: number[];
  pessimiste_xof: number[];
  optimiste_xof: number[];
}

export interface ForecastByStage {
  stage: string;
  weighted_xof: number;
}

export interface ForecastByClient {
  client: string;
  nb_opportunites: number;
  opportunities: ForecastOpportunity[];
  total_xof: number;
  weighted_xof: number;
  at_risk_xof: number;
  min_month_offset: number;
}

export interface PipelineForecastData {
  opportunities: ForecastOpportunity[];
  scenarios: ForecastScenarios;
  monthly_buckets: ForecastMonthlyBuckets;
  by_stage: ForecastByStage[];
  by_client: ForecastByClient[];
  month_labels: string[];
}

/** Forecast pondéré réel (pipeline ouvert Odoo synchronisé). Lève si le backend est indisponible. */
export async function fetchPipelineForecast(): Promise<PipelineForecastData> {
  return backendFetch<PipelineForecastData>("/v1/dashboard/forecast/pipeline-weighted");
}
