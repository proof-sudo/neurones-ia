import type { Partner } from "../types";

/**
 * Date de référence de l'outil (port du mockup v38 — pas Date.now() pour rester
 * déterministe : le statut « Dormant » et les échéances de certification sont
 * calculés par rapport à cette date, comme dans lib/valeur.ts).
 */
export const AUJOURDHUI = new Date(2026, 6, 17); // 17 juillet 2026

export const PARTNER_TYPES = [
  "Distribution IT",
  "Éditeur / Cloud",
  "Logistique / Transit",
  "Conseil",
  "Autre",
] as const;

/**
 * Fournisseurs réels (purchase_orders), portage exact du mockup dashboard_commercial_38.
 * `caGenere` = montant total commandé (M FCFA). `commandes` = bons de commande réels
 * (montants en devises d'origine, voir libellés). Trié par montant décroissant.
 */
export const PARTNERS: Partner[] = [
  {
    name: "HDF SAS", type: "Distribution IT",
    specialite: "Distributeur — montants en devises (EUR/USD), voir note qualité de données",
    since: "fournisseur actif", dealsApportes: 15, caGenere: 2902, contact: "non renseigné", statut: "actif",
    derniereCommande: "2025-09-26",
    commandes: [
      { ref: "BC/2025/07179", montant: 8.0, date: "2025-09-26 (USD)" },
      { ref: "BC/2025/07010", montant: 652.4, date: "2025-07-25 (EUR — montant probablement anormal)" },
      { ref: "BC/2025/06991", montant: 0.2, date: "2025-07-23 (EUR)" },
      { ref: "BC/2025/06870", montant: 272.9, date: "2025-05-30 (USD)" },
      { ref: "BC/2025/06868", montant: 2.8, date: "2025-05-30 (USD)" },
    ],
  },
  {
    name: "WESTCON", type: "Distribution IT",
    specialite: "Distributeur réseau/sécurité (Cisco, Fortinet et autres via ce canal)",
    since: "fournisseur actif", dealsApportes: 148, caGenere: 2427, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-07-09",
    commandes: [
      { ref: "BC/2026/07938", montant: 0.003, date: "2026-07-09 (USD)" },
      { ref: "BC/2026/07936", montant: 0.05, date: "2026-07-07 (USD)" },
      { ref: "BC/2026/07897", montant: 28.0, date: "2026-06-16 (USD)" },
      { ref: "BC/2026/07896", montant: 38.0, date: "2026-06-16 (USD)" },
      { ref: "BC/2026/07931", montant: 0.003, date: "2026-07-06 (USD)" },
    ],
  },
  {
    name: "HIPERDIST LIMITED", type: "Distribution IT",
    specialite: "Distribution IT — devises mixtes (XOF/EUR/USD)",
    since: "fournisseur actif", dealsApportes: 76, caGenere: 1821, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-05-29",
    commandes: [
      { ref: "BC/2026/07856", montant: 2.9, date: "2026-05-29 (USD)" },
      { ref: "BC/2026/07537", montant: 11.7, date: "2026-01-29 (XOF)" },
      { ref: "BC/2026/07534", montant: 25.7, date: "2026-01-28 (EUR)" },
      { ref: "BC/2026/07482", montant: 37.3, date: "2026-01-13 (XOF)" },
      { ref: "BC/2026/07480", montant: 6.7, date: "2026-01-13 (XOF)" },
    ],
  },
  {
    name: "POLARIS Distribution S.A.R.L", type: "Distribution IT",
    specialite: "Principal distributeur matériel en XOF (120 commandes 2025-2026)",
    since: "fournisseur actif", dealsApportes: 120, caGenere: 1241, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-07-10",
    commandes: [
      { ref: "BC/2026/07945", montant: 0.4, date: "2026-07-10" },
      { ref: "BC/2026/07928", montant: 5.0, date: "2026-07-03" },
      { ref: "BC/2026/07926", montant: 2.5, date: "2026-07-03" },
      { ref: "BC/2026/07925", montant: 8.1, date: "2026-07-02" },
      { ref: "BC/2026/07914", montant: 1.2, date: "2026-06-24" },
    ],
  },
  {
    name: "Microsoft CSP", type: "Éditeur / Cloud",
    specialite: "Programme CSP Microsoft — licences Office 365/Azure/Windows achetées via ce canal",
    since: "fournisseur actif", dealsApportes: 244, caGenere: 848, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-02-24",
    commandes: [
      { ref: "BC/2026/07609", montant: 0.7, date: "2026-02-24 (USD)" },
      { ref: "BC/2026/07603", montant: 0.9, date: "2026-02-19 (USD)" },
      { ref: "BC/2026/07600", montant: 3.7, date: "2026-02-18 (USD)" },
      { ref: "BC/2026/07570", montant: 0.4, date: "2026-02-05 (USD)" },
      { ref: "BC/2026/07559", montant: 14.4, date: "2026-02-03 (USD)" },
    ],
  },
  {
    name: "EXCLUSIVE NETWORKS France SAS", type: "Distribution IT",
    specialite: "Distributeur cybersécurité (dont Fortinet) — devises mixtes",
    since: "fournisseur actif", dealsApportes: 54, caGenere: 790, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-07-09",
    commandes: [
      { ref: "BC/2026/07940", montant: 0.003, date: "2026-07-09 (EUR)" },
      { ref: "BC/2026/07898", montant: 48.3, date: "2026-06-16 (USD)" },
      { ref: "BC/2026/07888", montant: 5.6, date: "2026-06-09 (USD)" },
      { ref: "BC/2026/07919", montant: 0.03, date: "2026-06-26 (USD)" },
    ],
  },
  {
    name: "EXCLUSIVE NETWORKS NORTH WEST AFRICA", type: "Distribution IT",
    specialite: "Distributeur cybersécurité (dont Fortinet) — région Afrique du Nord-Ouest",
    since: "fournisseur actif", dealsApportes: 82, caGenere: 648, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-07-09",
    commandes: [
      { ref: "BC/2026/07942", montant: 0.02, date: "2026-07-09 (USD)" },
      { ref: "BC/2026/07930", montant: 0.24, date: "2026-07-03 (EUR)" },
      { ref: "BC/2026/07924", montant: 0.49, date: "2026-07-02 (EUR)" },
      { ref: "BC/2026/07922", montant: 0.74, date: "2026-07-01 (EUR)" },
    ],
  },
  {
    name: "AITEK CI", type: "Distribution IT",
    specialite: "Distribution matériel/logiciel",
    since: "fournisseur actif", dealsApportes: 57, caGenere: 597, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-07-13",
    commandes: [
      { ref: "BC/2026/07951", montant: 0.6, date: "2026-07-13" },
      { ref: "BC/2026/07929", montant: 3.9, date: "2026-07-03" },
      { ref: "BC/2026/07894", montant: 0.4, date: "2026-06-15" },
      { ref: "BC/2026/07891", montant: 6.0, date: "2026-06-11" },
      { ref: "BC/2026/07868", montant: 2.4, date: "2026-06-03" },
    ],
  },
  {
    name: "MC3 LOGISTIQUE SAS", type: "Logistique / Transit",
    specialite: "Logistique/transit — devises mixtes",
    since: "fournisseur actif", dealsApportes: 4, caGenere: 482, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-06-24",
    commandes: [
      { ref: "BC/2026/07915", montant: 36.3, date: "2026-06-24 (EUR)" },
      { ref: "BC/2025/07269", montant: 1.1, date: "2025-11-05 (EUR)" },
      { ref: "BC/2025/06949", montant: 6.4, date: "2025-07-01 (EUR)" },
      { ref: "BC/2025/06571", montant: 437.9, date: "2025-02-03 (EUR — montant probablement anormal)" },
    ],
  },
  {
    name: "MITSUMI DISTRIBUTION FZCO", type: "Distribution IT",
    specialite: "Distribution IT régionale (Dubaï)",
    since: "fournisseur actif", dealsApportes: 4, caGenere: 378, contact: "non renseigné", statut: "actif",
    derniereCommande: "2025-06-20",
    commandes: [
      { ref: "BC/2025/06928", montant: 91.3, date: "2025-06-20 (USD)" },
      { ref: "BC/2024/06330", montant: 0.6, date: "2024-10-22 (USD)" },
      { ref: "BC/2024/06277", montant: 241.3, date: "2024-09-25 (USD)" },
      { ref: "BC/2024/06253", montant: 45.1, date: "2024-09-19 (USD)" },
    ],
  },
  {
    name: "HIPERDIST AFRICA", type: "Distribution IT",
    specialite: "Distribution IT régionale (Afrique)",
    since: "fournisseur actif", dealsApportes: 27, caGenere: 139, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-07-13",
    commandes: [
      { ref: "BC/2026/07949", montant: 5.9, date: "2026-07-13" },
      { ref: "BC/2026/07927", montant: 0.3, date: "2026-07-03" },
      { ref: "BC/2026/07903", montant: 0.3, date: "2026-06-18" },
      { ref: "BC/2026/07901", montant: 0.5, date: "2026-06-18" },
      { ref: "BC/2026/07890", montant: 0.7, date: "2026-06-11" },
    ],
  },
  {
    name: "CFAO MOBILITY", type: "Autre",
    specialite: "Groupe CFAO — mobilité/équipements (hors cœur IT)",
    since: "fournisseur actif", dealsApportes: 18, caGenere: 122, contact: "non renseigné", statut: "actif",
    derniereCommande: "2026-06-02",
    commandes: [
      { ref: "BC/2026/07866", montant: 0.1, date: "2026-06-02" },
      { ref: "BC/2026/07864", montant: 0.12, date: "2026-06-02" },
      { ref: "BC/2026/07863", montant: 0.1, date: "2026-06-02" },
      { ref: "BC/2026/07831", montant: 0.09, date: "2026-05-21" },
      { ref: "BC/2026/07793", montant: 0.25, date: "2026-05-06" },
    ],
  },
  {
    name: "HILANE TRANSIT", type: "Logistique / Transit",
    specialite: "Transit et dédouanement",
    since: "fournisseur actif", dealsApportes: 17, caGenere: 146, contact: "non renseigné", statut: "actif",
    derniereCommande: "2024-02-15",
    commandes: [
      { ref: "BC/2024/05778", montant: 3.0, date: "2024-02-15" },
      { ref: "BC/2024/05777", montant: 0.8, date: "2024-02-15" },
      { ref: "BC/2024/05776", montant: 2.8, date: "2024-02-15" },
      { ref: "BC/2024/05769", montant: 2.1, date: "2024-02-14" },
      { ref: "BC/2024/05760", montant: 5.4, date: "2024-02-13" },
    ],
  },
  {
    name: "DIGITAL DATA CAPTURE SOLUTIONS", type: "Distribution IT",
    specialite: "Solutions de capture de données",
    since: "fournisseur actif", dealsApportes: 6, caGenere: 80, contact: "non renseigné", statut: "actif",
    derniereCommande: "2025-12-08",
    commandes: [
      { ref: "BC/2025/07362", montant: 3.0, date: "2025-12-08" },
      { ref: "BC/2025/07361", montant: 3.1, date: "2025-12-08" },
      { ref: "BC/2025/07116", montant: 7.1, date: "2025-09-09" },
      { ref: "BC/2025/06567", montant: 0.6, date: "2025-01-30" },
      { ref: "BC/2024/06313", montant: 58.3, date: "2024-10-10" },
    ],
  },
  {
    name: "EDEN CONSULTING", type: "Conseil",
    specialite: "Conseil (nature exacte non détaillée)",
    since: "fournisseur actif", dealsApportes: 2, caGenere: 75, contact: "non renseigné", statut: "actif",
    derniereCommande: "2025-10-28",
    commandes: [
      { ref: "BC/2025/07220", montant: 44.8, date: "2025-10-28" },
      { ref: "BC/2025/07221", montant: 30.6, date: "2025-10-28" },
    ],
  },
  {
    name: "KUKUZA AFRICA", type: "Autre",
    specialite: "Fournisseur — nature exacte non déterminable des données",
    since: "fournisseur actif", dealsApportes: 24, caGenere: 107, contact: "non renseigné", statut: "actif",
    derniereCommande: "2024-12-19",
    commandes: [
      { ref: "BC/2024/06510", montant: 1.4, date: "2024-12-19" },
      { ref: "BC/2024/06494", montant: 0.4, date: "2024-12-16" },
      { ref: "BC/2024/06480", montant: 2.3, date: "2024-12-10" },
      { ref: "BC/2024/06457", montant: 0.4, date: "2024-12-02" },
      { ref: "BC/2024/06440", montant: 0.7, date: "2024-11-27" },
    ],
  },
  {
    name: "AGL (ex Bolloré Transport & Logistics CI)", type: "Logistique / Transit",
    specialite: "Transport et logistique",
    since: "fournisseur actif", dealsApportes: 8, caGenere: 63, contact: "non renseigné", statut: "actif",
    derniereCommande: "2024-01-22",
    commandes: [
      { ref: "BC/2024/—", montant: 63, date: "2024-01-22 (8 commandes agrégées)" },
    ],
  },
];

/**
 * Certifications par fournisseur, suivies par le service Marketing pour maintenir
 * le niveau de partenariat (Gold/Silver/Bronze). AUCUNE donnée réelle de certification
 * n'existe dans neurones.db (la table kb_certification est vide et concerne des personnes,
 * pas des fournisseurs) — ceci est un exemple illustratif en attendant un vrai suivi Marketing.
 * Mapping aligné sur le mockup v38.
 */
export interface Certification {
  nom: string;
  statut: "Validée" | "À renouveler" | "À vérifier";
  echeance: string | null;
}

export const CERTIFICATIONS_FOURNISSEURS: Record<string, Certification[]> = {
  WESTCON: [
    { nom: "Cisco Gold Certified Partner", statut: "Validée", echeance: "2027-03-15" },
    { nom: "Fortinet Authorized Distributor", statut: "À renouveler", echeance: "2026-09-10" },
  ],
  "HIPERDIST LIMITED": [
    { nom: "Cisco Select Certified Partner", statut: "À renouveler", echeance: "2026-07-31" },
  ],
  "EXCLUSIVE NETWORKS France SAS": [
    { nom: "Fortinet Platinum Partner", statut: "À renouveler", echeance: "2026-08-20" },
  ],
  "EXCLUSIVE NETWORKS NORTH WEST AFRICA": [
    { nom: "Fortinet Platinum Partner", statut: "À renouveler", echeance: "2026-08-20" },
  ],
  "Microsoft CSP": [
    { nom: "Microsoft Solutions Partner — Modern Work", statut: "Validée", echeance: "2027-01-12" },
  ],
  "HDF SAS": [
    { nom: "Partenariat distributeur — certification non communiquée", statut: "À vérifier", echeance: null },
  ],
};

/**
 * Exposition financière par fournisseur pour les « Points de vigilance » du tableau de bord.
 * Proxy réel = montant commandé sur les 12 derniers mois (purchase_orders) — la dette exacte
 * par fournisseur n'est PAS ventilée dans neurones.db. Trié par exposition décroissante.
 */
export interface ExpositionFournisseur {
  name: string;
  expo12m: number;
  cmd12m: number;
}

export const EXPOSITION_FOURNISSEURS: ExpositionFournisseur[] = [
  { name: "POLARIS Distribution S.A.R.L", expo12m: 935, cmd12m: 95 },
  { name: "WESTCON", expo12m: 687, cmd12m: 58 },
  { name: "HDF SAS", expo12m: 661, cmd12m: 3 },
  { name: "HIPERDIST LIMITED", expo12m: 651, cmd12m: 44 },
];

/** Nombre de jours écoulés depuis une date de commande, par rapport à AUJOURDHUI. */
export function joursDepuisCommande(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.round((AUJOURDHUI.getTime() - d.getTime()) / 86_400_000);
}

/**
 * Niveau de partenariat : règle réelle sur le montant total + l'activité récente
 * (pas de donnée Odoo dédiée). Un fournisseur sans commande depuis > 1 an est « Dormant ».
 */
export function niveauPartenariat(p: Partner): { label: string; color: string } {
  if (joursDepuisCommande(p.derniereCommande) > 365) return { label: "Dormant", color: "var(--color-bad)" };
  if (p.caGenere >= 500) return { label: "Gold", color: "var(--color-ai)" };
  if (p.caGenere >= 100) return { label: "Silver", color: "var(--color-good)" };
  return { label: "Bronze", color: "var(--color-warn)" };
}

/** Total commandé sur l'ensemble des fournisseurs (base du risque de dépendance). */
export const TOTAL_COMMANDE_FOURNISSEURS = PARTNERS.reduce((s, p) => s + p.caGenere, 0);

/** Risque de dépendance : part réelle du fournisseur dans le total commandé —
 * « si ça casse avec lui, combien ça coûte ? ». */
export function risqueDependance(caGenere: number): { label: string; color: string; part: number } {
  const part = (caGenere / TOTAL_COMMANDE_FOURNISSEURS) * 100;
  if (part > 25) return { label: "Élevé", color: "var(--color-bad)", part };
  if (part > 10) return { label: "Modéré", color: "var(--color-warn)", part };
  return { label: "Faible", color: "var(--color-good)", part };
}
