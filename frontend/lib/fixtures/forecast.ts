import { KANBAN_DATA } from "./pipeline";

export const FORECAST_MONTHS = ["Sept", "Oct", "Nov", "Déc", "Jan", "Fév"];

const STAGE_MONTH_OFFSET: Record<string, number> = {
  Prospection: 5,
  Qualification: 4,
  Montage: 3,
  Transmise: 3,
  Proposition: 2,
  Négociation: 1,
  Contractualisation: 0,
};

export interface ForecastOpp {
  name: string;
  client: string;
  com: string;
  stage: string;
  val: number;
  prob: number;
  offset: number;
}

/** Aplati le kanban en opportunités de forecast (val numérique + offset mensuel). */
export function buildForecastOpps(): ForecastOpp[] {
  const opps: ForecastOpp[] = [];
  for (const [stage, cards] of Object.entries(KANBAN_DATA)) {
    for (const c of cards) {
      opps.push({
        name: c.name,
        client: c.client,
        com: c.com,
        stage,
        val: parseFloat(c.val),
        prob: c.prob,
        offset: STAGE_MONTH_OFFSET[stage] ?? 3,
      });
    }
  }
  return opps;
}

export const FORECAST_OPPS = buildForecastOpps();

// ---------- Performances ----------

export interface LostDeal {
  name: string;
  client: string;
  montant: number;
  commercial: string;
}

export const LOST_DEALS: LostDeal[] = [
  { name: "Sauvegarde Commvault", client: "BNI", montant: 1800, commercial: "Segui Mireille KOUADIO" },
  { name: "Acquisition équipements Cisco (AO)", client: "BNI", montant: 1327, commercial: "Segui Mireille KOUADIO" },
  { name: "AO Lan Wifi", client: "MTN CI", montant: 1190, commercial: "Aristide D. CAUPHY" },
  { name: "SDWAN Forti pour 32 pays", client: "BAD", montant: 1065, commercial: "Aristide D. CAUPHY" },
  { name: "Internet GW Cisco", client: "MTN CI", montant: 893, commercial: "Aristide D. CAUPHY" },
  { name: "Projet WAN Refresh", client: "ORANGE CI", montant: 848, commercial: "Aristide D. CAUPHY" },
];

export const LOST_BY_COMMERCIAL = [
  { name: "SERGE YAO YAO", n: 488, montant: 12396 },
  { name: "Aristide D. CAUPHY", n: 257, montant: 37607 },
  { name: "Guy-Martial DATCHA", n: 179, montant: 5506 },
  { name: "Segui Mireille KOUADIO", n: 165, montant: 18352 },
  { name: "Ama GAYAKPA", n: 146, montant: 2732 },
  { name: "Jacques Marie DRIGBE", n: 51, montant: 3421 },
];
