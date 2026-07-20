import type {
  KpiDetail,
  PeriodData,
  PeriodKey,
  PipelineStage,
  TopClient,
} from "../types";
import { FORECAST_OPPS } from "./forecast";

/** Données KPI + séries du graphe CA, par période. */
export const PERIOD_DATA: Record<PeriodKey, PeriodData> = {
  mois: {
    caLabel: "CA commandé (juillet 2026)",
    ca: "537 M FCFA",
    caDelta: "▼ 14,5 % vs juin 2026",
    objectif: "▼ 39,1 %",
    objectifDelta: "vs juillet 2025 (882 M FCFA)",
    marge: "78,9 %",
    margeDelta: "moyenne 2025-2026 (365 dossiers)",
    pipeline: "107 677 M FCFA",
    pipelineDelta: "3 050 opportunités ouvertes",
    transfo: "65,4 %",
    transfoDelta: "2 677 gagnées / 4 091 clôturées (historique)",
    months: ["Avr", "Mai", "Juin", "Juil"],
    realise: [818, 1153, 628, 537],
    prevision: [null, null, null, null],
  },
  trimestre: {
    caLabel: "CA commandé (T2 2026)",
    ca: "2 563 M FCFA",
    caDelta: "▲ 2,1 % vs T2 2025",
    objectif: "▲ 2,1 %",
    objectifDelta: "vs T2 2025 (2 509 M FCFA)",
    marge: "78,9 %",
    margeDelta: "moyenne 2025-2026 (365 dossiers)",
    pipeline: "107 677 M FCFA",
    pipelineDelta: "3 050 opportunités ouvertes",
    transfo: "65,4 %",
    transfoDelta: "2 677 gagnées / 4 091 clôturées (historique)",
    months: ["Avr", "Mai", "Juin"],
    realise: [818, 1153, 628],
    prevision: [null, null, null],
  },
  annee: {
    caLabel: "CA commandé (2026, jan-juil)",
    ca: "4 313 M FCFA",
    caDelta: "▼ 29,3 % vs jan-juil 2025",
    objectif: "▼ 29,3 %",
    objectifDelta: "vs jan-juil 2025 (6 098 M FCFA)",
    marge: "78,9 %",
    margeDelta: "moyenne 2025-2026 (365 dossiers)",
    pipeline: "107 677 M FCFA",
    pipelineDelta: "3 050 opportunités ouvertes",
    transfo: "65,4 %",
    transfoDelta: "2 677 gagnées / 4 091 clôturées (historique)",
    months: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil"],
    realise: [526, 336, 316, 818, 1153, 628, 537],
    prevision: [null, null, null, null, null, null, null],
  },
};

/*
 * Port de injectForecastIntoDashboard() du mockup : injecte une prévision IA
 * (2 mois à venir) dans le graphe CA, en réutilisant le même calcul pondéré
 * (valeur × probabilité) que le module Forecast.
 */
{
  const buckets = new Array(6).fill(0);
  FORECAST_OPPS.forEach((o) => {
    buckets[Math.min(o.offset, 5)] += (o.val * o.prob) / 100;
  });
  const prev1 = Math.round(buckets[0]);
  const prev2 = Math.round(buckets[1]);
  const NEXT_MONTHS: Record<PeriodKey, string[]> = {
    mois: ["Août", "Sept"],
    trimestre: ["Juil", "Août"],
    annee: ["Août", "Sept"],
  };
  (Object.keys(PERIOD_DATA) as PeriodKey[]).forEach((key) => {
    const pd = PERIOD_DATA[key];
    const lastRealValue = pd.realise[pd.realise.length - 1];
    pd.months = [...pd.months, ...NEXT_MONTHS[key]];
    pd.realise = [...pd.realise, null, null];
    const prevision: (number | null)[] = new Array(pd.months.length).fill(null);
    prevision[pd.realise.length - 3] = lastRealValue; // jonction avec le dernier mois réel
    prevision[pd.months.length - 2] = prev1;
    prevision[pd.months.length - 1] = prev2;
    pd.prevision = prevision;
  });
}

// ---------- Faits marquants (apercu rapide du mockup) ----------

/** Vrais marchés marquants par pays (table dossiers, triés par montant réel). */
export const MARCHES_PAR_PAYS: Record<
  string,
  { client: string; projet: string; montant: number }[]
> = {
  "Côte d'Ivoire": [
    { client: "Orange Côte d'Ivoire", projet: "Digitalisation nouveau siège on premise", montant: 886 },
    { client: "Orange Côte d'Ivoire", projet: "MPBN without NMS", montant: 769 },
    { client: "Société Générale Côte d'Ivoire", projet: "Matériel informatique Lot 2", montant: 727 },
    { client: "Orange Côte d'Ivoire", projet: "COCAN", montant: 695 },
  ],
  "Burkina Faso": [
    { client: "Orange Burkina Faso", projet: "Infra DC Bama", montant: 900 },
    { client: "Orange BF", projet: "Balkuy 2025", montant: 848 },
    { client: "Orange Burkina Faso", projet: "Mobiquiky — Load balancing F5 PR & DR", montant: 531 },
    { client: "Coris Holding Burkina Faso", projet: "Acquisition équipement réseau data center", montant: 295 },
  ],
};

/** Vrai plus gros marché apporté par chaque commercial (table dossiers). */
export const TOP_DEAL_BY_COMMERCIAL: Record<
  string,
  { client: string; projet: string; montant: number }
> = {
  "Aristide D. CAUPHY": { client: "Orange Côte d'Ivoire", projet: "Extension VMware", montant: 536 },
  "Segui M. KOUADIO": { client: "Orange Liberia", projet: "IP Fabric", montant: 1619 },
  "Inès C. DASSE": { client: "ARCEP", projet: "Réseau sécurité", montant: 356 },
  "Guy-Martial DATCHA": { client: "Standard Chartered Bank", projet: "AV Meeting Room", montant: 202 },
  "Pierre Yves YORO": {
    client: "Atlantic Business International (ABI)",
    projet: "Fourniture et déploiement pare-feux/switchs/routeurs Lot 3",
    montant: 161,
  },
};

/** Détail drill-down par gauge KPI. */
export const KPI_DETAILS: Record<string, KpiDetail> = {
  ca: {
    title: "Détail — CA commandé",
    items: [
      ["CA Côte d'Ivoire (estimation)", "~2 900 M FCFA"],
      ["CA Burkina Faso (estimation)", "~1 200 M FCFA"],
      ["Meilleur mois 2026", "Mai — 1 153 M FCFA"],
      ["Plus faible mois 2026", "Mars — 316 M FCFA"],
      ["Nb commandes 2026 (jan-juil)", "238"],
      ["Panier moyen", "18,1 M FCFA"],
      ["Nb commandes 2025 (jan-juil)", "242"],
      ["Évolution nb commandes", "-1,7 %"],
    ],
  },
  objectif: {
    title: "Détail — Rythme vs 2025",
    items: [
      ["CA 2026 (jan-juil)", "4 313 M FCFA"],
      ["CA 2025 (jan-juil)", "6 098 M FCFA"],
      ["Écart", "-1 785 M FCFA (-29,3 %)"],
      ["CA 2025 (année complète)", "11 854 M FCFA"],
      ["Meilleur contributeur", "Aristide D. CAUPHY — 1 665 M FCFA"],
      ["Mois le plus faible 2026", "Mars — 316 M FCFA"],
      ["T2 2026 vs T2 2025", "+2,1 % (stable)"],
      ["Constat IA", "baisse concentrée sur T1 2026, T2 en ligne avec 2025"],
    ],
  },
  marge: {
    title: "Détail — Marge commerciale",
    items: [
      ["Marge moyenne (dossiers 2025-2026)", "78,9 %"],
      ["Nb dossiers avec CA définitif", "365"],
      ["Reste à encaisser (dossiers actifs)", "2 818 M FCFA"],
      ["Backlog non facturé", "6 086 M FCFA"],
      ["Fournisseurs restant à payer", "à vérifier en compta"],
      ["Statut", "donnée à valider avec la Direction Financière"],
      ["Source", "table dossiers (Odoo)"],
      [
        "Recommandation IA",
        "ce taux moyen semble élevé — faire vérifier le calcul par la Direction Financière avant diffusion",
      ],
    ],
  },
  pipeline: {
    title: "Détail — Pipeline ouvert",
    items: [
      ["Valeur totale", "107 677 M FCFA"],
      ["Nb opportunités", "3 050"],
      ["Valeur pondérée (proba)", "39 469 M FCFA"],
      ["Âge moyen opportunité", "891 jours"],
      ["Plus grosse opportunité", "Orange Côte d'Ivoire — Refresh WAN — 3 673 M FCFA"],
      ["Opportunités > 1 an", "1 048 (34 %)"],
      ["Étape la plus chargée", "Qualification — 1 190 opp."],
      [
        "Recommandation IA",
        "purger les opportunités obsolètes (> 2 ans) pour fiabiliser le pipeline",
      ],
    ],
  },
  transfo: {
    title: "Détail — Taux de transformation",
    items: [
      ["Opportunités gagnées (historique)", "2 677"],
      ["Opportunités perdues (historique)", "1 414"],
      ["Taux de victoire (nb)", "65,4 %"],
      ["Valeur gagnée 2026 (write_date)", "10 327 M FCFA"],
      ["Valeur perdue 2026 (write_date)", "32 070 M FCFA"],
      ["Taux de victoire (valeur, 2026)", "24,3 %"],
      ["Meilleur commercial", "Aristide D. CAUPHY"],
      [
        "Constat IA",
        "le taux de victoire en valeur est bien plus faible qu'en nombre — les dossiers perdus sont en moyenne plus gros",
      ],
    ],
  },
};

export const COMMERCIAUX_NAMES = [
  "Aristide D. CAUPHY",
  "Segui M. KOUADIO",
  "Inès C. DASSE",
  "Guy-Martial DATCHA",
  "Pierre Yves YORO",
];
export const COMMERCIAUX_CA = [1665, 1259, 1147, 1126, 473];

export const SECTEUR_LABELS = [
  "Côte d'Ivoire",
  "Burkina Faso",
  "France",
  "Maroc",
  "Autres/non renseigné",
];
export const SECTEUR_VALUES = [211, 91, 14, 8, 1178];
export const SECTEUR_COLORS = ["#FF6A00", "#0EA37A", "#C77D00", "#8C6E54", "#6B6D75"];

export const PIPELINE_STAGES: PipelineStage[] = [
  { name: "Prospection", n: 409, val: "9 056 M FCFA" },
  { name: "Qualification", n: 1190, val: "47 717 M FCFA" },
  { name: "Montage", n: 108, val: "4 010 M FCFA" },
  { name: "Transmise", n: 707, val: "26 730 M FCFA" },
  { name: "Proposition", n: 417, val: "15 354 M FCFA" },
  { name: "Négociation", n: 211, val: "4 709 M FCFA" },
  { name: "Contractualisation", n: 8, val: "100 M FCFA" },
];

export const TOP_CLIENTS: TopClient[] = [
  { name: "Orange Burkina Faso", ca: 1584, pct: 100, secteur: "Côte d'Ivoire" },
  { name: "MTN CI", ca: 1317, pct: 83, secteur: "Côte d'Ivoire" },
  { name: "Société Générale Côte d'Ivoire", ca: 1294, pct: 82, secteur: "Côte d'Ivoire" },
  { name: "Orange BF", ca: 1000, pct: 63, secteur: "Burkina Faso" },
  { name: "Kaydan Technology", ca: 756, pct: 48, secteur: "Côte d'Ivoire" },
  { name: "BICICI", ca: 621, pct: 39, secteur: "Côte d'Ivoire" },
  { name: "Atlantic Business International (ABI)", ca: 599, pct: 38, secteur: "Côte d'Ivoire" },
  { name: "DSIS-Ministère de la Santé", ca: 512, pct: 32, secteur: "Côte d'Ivoire" },
  { name: "Banque Postale Burkina Faso (BPBF)", ca: 421, pct: 27, secteur: "Burkina Faso" },
  { name: "Coris Holding Burkina Faso", ca: 331, pct: 21, secteur: "Burkina Faso" },
];

