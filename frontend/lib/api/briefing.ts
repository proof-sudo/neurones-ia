import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/briefing ----------

export interface BriefingSection {
  facts: Record<string, unknown>;
  bullets: string[];
  analysis: string;
}

export interface BriefingData {
  generated_at: string | null;
  triggered_by: string | null;
  role: string;
  section: BriefingSection | null;
}

/** Briefing quotidien du rôle courant (gelé jusqu'à minuit). Lève si le backend est indisponible. */
export async function fetchBriefing(): Promise<BriefingData> {
  return backendFetch<BriefingData>("/v1/briefing");
}
