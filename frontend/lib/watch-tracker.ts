// ── S2I Watch-Tracker — grille de correspondance & classifieur ────────────────
// Transforme un signal de veille brut (VeilleEntry) en opportunité commerciale
// actionnable, façon blueprint « S2I Watch-Tracker » : signal → risque → offre.
//
// Lot 3 : la classification est faite CÔTÉ FRONT par règles de mots-clés, à partir
// des vraies entrées de /veille/feed. La remontée dans le backend (Lot 1) se fera
// sans changer ce contrat de types.

import type { VeilleEntry } from "@/lib/api";

export type Priority = "CRITIQUE" | "ELEVEE" | "MOYENNE";

export const PRIORITY_ORDER: Record<Priority, number> = {
  CRITIQUE: 0,
  ELEVEE: 1,
  MOYENNE: 2,
};

export interface S2IRule {
  /** Identifiant stable de la règle. */
  id: string;
  /** Libellé du signal détecté (colonne « Signal détecté en CI »). */
  signalLabel: string;
  /** Risque client associé (colonne « Risque client associé »). */
  risque: string;
  /** Offre S2I à positionner (texte complet). */
  offre: string;
  /** Étiquette courte de l'offre, pour les badges (ex: « SD-WAN »). */
  offreShort: string;
  /** Priorité de veille. */
  priority: Priority;
  /** Mots-clés déclencheurs (recherchés dans titre + description, sans accents). */
  keywords: string[];
}

/**
 * Grille de correspondance S2I (source : blueprint S2I Watch-Tracker v1.0, §2).
 * L'ordre compte : la première règle qui matche gagne.
 */
export const S2I_GRILLE: S2IRule[] = [
  {
    id: "fibre-travaux",
    signalLabel: "Grands travaux routiers à Abidjan (métro, échangeurs)",
    risque: "Coupures fréquentes de la fibre optique par arrachement de câbles.",
    offre: "Solutions SD-WAN multi-liens avec failover automatique 4G/5G / Faisceau hertzien.",
    offreShort: "SD-WAN",
    priority: "CRITIQUE",
    keywords: [
      "travaux", "metro", "echangeur", "voirie", "route", "chantier",
      "fibre", "cable", "arrachement", "pont", "terrassement", "genie civil",
    ],
  },
  {
    id: "nouveau-dsi",
    signalLabel: "Nouveau Directeur des Systèmes d'Information (DSI) nommé",
    risque: "Audit technique et renégociation des anciens contrats de l'ex-DSI.",
    offre: "Audit Flash & Conseil (optimisation SI, audit sécurité de l'infrastructure).",
    offreShort: "Audit Flash",
    priority: "ELEVEE",
    keywords: [
      "dsi", "directeur des systemes", "directeur informatique", "nomination",
      "nomme", "nommee", "prise de fonction", "nouveau directeur", "cio",
    ],
  },
  {
    id: "poste-vacant",
    signalLabel: "Offre d'emploi IT vacante depuis plus de 2 mois",
    risque: "Surcharge interne, défaillances de maintenance opérationnelle.",
    offre: "Services Managés / NOC as a Service (externalisation du monitoring).",
    offreShort: "Services Managés",
    priority: "MOYENNE",
    keywords: [
      "recrute", "recrutement", "offre d'emploi", "poste", "vacant", "vacance",
      "administrateur reseau", "admin reseau", "ingenieur", "technicien", "cdi", "emploi",
    ],
  },
  {
    id: "cyber-artci",
    signalLabel: "Incident cyber sous-régional ou directive stricte de l'ARTCI",
    risque: "Pertes financières massives, amendes de non-conformité réglementaire.",
    offre: "Sauvegarde Hybride & PRA (Plan de Reprise d'Activité) / SOC managé.",
    offreShort: "PRA / SOC",
    priority: "CRITIQUE",
    keywords: [
      "cyber", "artci", "incident", "ransomware", "rancongiciel", "faille",
      "attaque", "piratage", "fuite de donnees", "conformite", "reglementaire",
      "directive", "securite", "cnil", "rgpd",
    ],
  },
];

/** Règle de repli quand aucun signal de la grille n'est reconnu. */
export const FALLBACK_RULE: S2IRule = {
  id: "a-qualifier",
  signalLabel: "Signal à qualifier",
  risque: "Besoin client non encore caractérisé — qualification commerciale requise.",
  offre: "Conseil SI & cadrage d'opportunité.",
  offreShort: "À qualifier",
  priority: "MOYENNE",
  keywords: [],
};

export interface Opportunity {
  entry: VeilleEntry;
  rule: S2IRule;
  /** true si le signal a matché une règle de la grille (hors repli). */
  matched: boolean;
}

/** Normalise une chaîne : minuscules + suppression des accents. */
function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Classe une entrée de veille selon la grille S2I.
 * Retourne la première règle dont un mot-clé apparaît dans titre + description.
 */
export function classifyEntry(entry: VeilleEntry): Opportunity {
  const haystack = normalize(`${entry.title} ${entry.description}`);
  for (const rule of S2I_GRILLE) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return { entry, rule, matched: true };
    }
  }
  return { entry, rule: FALLBACK_RULE, matched: false };
}

/** Classe et trie un flux d'entrées : priorité décroissante puis score décroissant. */
export function buildOpportunities(entries: VeilleEntry[]): Opportunity[] {
  return entries
    .map(classifyEntry)
    .sort((a, b) => {
      const p = PRIORITY_ORDER[a.rule.priority] - PRIORITY_ORDER[b.rule.priority];
      if (p !== 0) return p;
      return (b.entry.relevance_score ?? 0) - (a.entry.relevance_score ?? 0);
    });
}

// ── Districts d'Abidjan (pour le sélecteur de région) ─────────────────────────
export const ABIDJAN_DISTRICTS = [
  "abidjan", "plateau", "cocody", "marcory", "treichville", "yopougon",
  "zone 4", "adjame", "koumassi", "port-bouet", "attecoube", "abobo",
  "bingerville", "riviera", "deux plateaux",
];

export type Region = "all" | "abidjan" | "interieur";

/** Filtre les opportunités par région (District d'Abidjan / Intérieur). */
export function filterByRegion(opps: Opportunity[], region: Region): Opportunity[] {
  if (region === "all") return opps;
  return opps.filter((o) => {
    const hay = normalize(`${o.entry.title} ${o.entry.description}`);
    const isAbidjan = ABIDJAN_DISTRICTS.some((d) => hay.includes(d));
    return region === "abidjan" ? isAbidjan : !isAbidjan;
  });
}

// ── Niveau de menace cyber (indicateur ARTCI) ─────────────────────────────────
export type ThreatLevel = "FAIBLE" | "MODERE" | "ELEVE";

/**
 * Dérive un niveau de menace cyber local à partir du nombre de signaux
 * cyber/ARTCI critiques actifs dans le flux.
 */
export function computeThreatLevel(opps: Opportunity[]): ThreatLevel {
  const cyber = opps.filter(
    (o) => o.rule.id === "cyber-artci" && o.entry.status !== "archived",
  ).length;
  if (cyber >= 3) return "ELEVE";
  if (cyber >= 1) return "MODERE";
  return "FAIBLE";
}

// ── Pipe commercial ───────────────────────────────────────────────────────────
export interface PipeStats {
  detectees: number;
  enAvantVente: number;
  critiques: number;
  /** Estimation indicative de CA récurrent annuel (services managés), en FCFA. */
  caRecurrentEstime: number;
}

/** Valeur récurrente annuelle indicative par type d'offre (FCFA/an). */
const OFFER_ARR: Record<string, number> = {
  "SD-WAN": 18_000_000,
  "Audit Flash": 6_000_000,
  "Services Managés": 24_000_000,
  "PRA / SOC": 30_000_000,
  "À qualifier": 0,
};

export function computePipeStats(opps: Opportunity[]): PipeStats {
  const active = opps.filter((o) => o.entry.status !== "archived");
  const enAvantVente = active.filter((o) => o.entry.status === "in_presales");
  return {
    detectees: active.length,
    enAvantVente: enAvantVente.length,
    critiques: active.filter((o) => o.rule.priority === "CRITIQUE").length,
    caRecurrentEstime: enAvantVente.reduce(
      (sum, o) => sum + (OFFER_ARR[o.rule.offreShort] ?? 0),
      0,
    ),
  };
}

export function formatFcfa(n: number): string {
  if (n <= 0) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;
}

// ── Pitch de vente instantané ─────────────────────────────────────────────────
// Lot 3 : pitch généré par gabarit côté front. Lot 1 : à remplacer par un appel
// LLM (réutilisation du moteur /presales/generate) sans changer l'appelant.
export function buildPitch(opp: Opportunity): string {
  const { entry, rule } = opp;
  return [
    `**Contexte détecté**`,
    `Signal : « ${entry.title} »`,
    `Type : ${rule.signalLabel}.`,
    ``,
    `**Le risque pour le client**`,
    rule.risque,
    ``,
    `**Notre réponse — ${rule.offreShort}**`,
    rule.offre,
    ``,
    `**Argumentaire d'ouverture**`,
    `« Suite à ${entry.title.toLowerCase()}, votre organisation est exposée à ${rule.risque.toLowerCase()} ` +
      `En tant que S2I d'infrastructures, réseaux et cybersécurité à Abidjan, nous déployons ${rule.offre} ` +
      `Nous vous proposons un cadrage express de 30 minutes pour chiffrer l'impact et sécuriser votre continuité d'activité. »`,
    ``,
    `**Prochaine étape suggérée**`,
    rule.priority === "CRITIQUE"
      ? "Prise de contact sous 48 h — priorité critique."
      : rule.priority === "ELEVEE"
        ? "Prise de contact cette semaine — priorité élevée."
        : "Intégrer au plan de prospection du mois.",
  ].join("\n");
}
