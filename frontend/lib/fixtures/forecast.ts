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
  risk?: boolean;
  age?: string;
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
        val: parseFloat(String(c.val).replace(/\s/g, "")),
        prob: c.prob,
        offset: STAGE_MONTH_OFFSET[stage] ?? 3,
        risk: c.risk,
        age: c.age,
      });
    }
  }
  return opps;
}

export const FORECAST_OPPS = buildForecastOpps();

// ---------- Forecast agrégé par client ----------

export interface ForecastClient {
  client: string;
  opps: ForecastOpp[];
  total: number;
  pondere: number;
  risque: number;
  minOffset: number;
}

/** Regroupe les opportunités réelles du pipeline par client (trié par valeur pondérée). */
export function buildForecastParClient(): ForecastClient[] {
  const parClient: Record<string, ForecastClient> = {};
  FORECAST_OPPS.forEach((o) => {
    if (!parClient[o.client]) {
      parClient[o.client] = { client: o.client, opps: [], total: 0, pondere: 0, risque: 0, minOffset: 5 };
    }
    const c = parClient[o.client];
    c.opps.push(o);
    c.total += o.val;
    c.pondere += (o.val * o.prob) / 100;
    if (o.risk) c.risque += (o.val * o.prob) / 100;
    c.minOffset = Math.min(c.minOffset, o.offset);
  });
  return Object.values(parClient).sort((a, b) => b.pondere - a.pondere);
}

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

/** Pertes agrégées par CLIENT (où l'entreprise perd le plus, en valeur réelle). */
export const LOST_BY_CLIENT = [
  { name: "MTN CI", n: 105, montant: 19585 },
  { name: "BNI", n: 16, montant: 5593 },
  { name: "ABI", n: 38, montant: 5280 },
  { name: "BCEAO", n: 24, montant: 4747 },
  { name: "Orange Côte d’Ivoire", n: 29, montant: 4119 },
  { name: "BAD", n: 7, montant: 2250 },
  { name: "FOXTROT", n: 21, montant: 2098 },
  { name: "ECOBANK CI", n: 9, montant: 1983 },
];

// ---------- Impayés (trésorerie) ----------

export interface Impaye {
  client: string;
  montant: number;
  jours: number;
  souffrance?: number;
}

/** Les 3 impayés réels les plus critiques (sur 10,86 Md FCFA échus au total, 842 factures). */
export const IMPAYES_PAR_CLIENT: Impaye[] = [
  { client: "Banque Africaine de Développement (BAD)", montant: 1682, jours: 444, souffrance: 756 },
  { client: "Orange Côte d’Ivoire", montant: 314, jours: 569 },
  { client: "Orange Liberia", montant: 273, jours: 833 },
].sort((a, b) => b.jours - a.jours);

/** Total des impayés échus du portefeuille (M FCFA). */
export const TOTAL_IMPAYES = 10860;

/**
 * Impayés réels pour les « Points de vigilance » du tableau de bord (avec contexte rédigé).
 * Triés par ancienneté : le plus ancien = le plus critique.
 */
export interface VigilanceImpaye {
  client: string;
  montant: number;
  jours: number;
  contexte: string;
}

export const VIGILANCE_IMPAYES: VigilanceImpaye[] = [
  { client: "BAD", montant: 1682, jours: 444, contexte: "1 682 M FCFA cumulés sur 3 factures, dont 756 M FCFA en souffrance depuis 444 jours. Cellule de recouvrement dédiée recommandée dans le briefing (DG + DAF)." },
  { client: "Orange Côte d’Ivoire", montant: 314, jours: 569, contexte: "314 M FCFA échus depuis 569 jours, alors que le client reste actif commercialement (opportunités en cours dans le pipeline)." },
  { client: "Orange Liberia", montant: 273, jours: 833, contexte: "273 M FCFA échus depuis 833 jours — l'impayé le plus ancien du portefeuille, à traiter avant qu'il ne devienne comptablement irrécouvrable." },
].sort((a, b) => b.jours - a.jours);

export function severiteImpaye(jours: number): { label: string; color: string } {
  if (jours > 700) return { label: "Critique", color: "var(--color-bad)" };
  if (jours > 400) return { label: "Élevée", color: "var(--color-warn)" };
  return { label: "À surveiller", color: "var(--color-good)" };
}
