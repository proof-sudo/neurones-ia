import type { Partner } from "../types";

export const PARTNER_TYPES = [
  "Distribution IT",
  "Logistique / Transit",
  "Conseil",
  "Autre",
] as const;

export const PARTNERS: Partner[] = [
  { name: "POLARIS Distribution S.A.R.L", type: "Distribution IT", specialite: "Principal distributeur matériel (120 commandes 2025-2026)", since: "fournisseur actif", dealsApportes: 120, caGenere: 1241, contact: "non renseigné", statut: "actif" },
  { name: "AITEK CI", type: "Distribution IT", specialite: "Distribution matériel/logiciel", since: "fournisseur actif", dealsApportes: 57, caGenere: 597, contact: "non renseigné", statut: "actif" },
  { name: "HIPERDIST AFRICA", type: "Distribution IT", specialite: "Distribution IT régionale (Afrique)", since: "fournisseur actif", dealsApportes: 27, caGenere: 139, contact: "non renseigné", statut: "actif" },
  { name: "HIPERDIST LIMITED", type: "Distribution IT", specialite: "Distribution IT", since: "fournisseur actif", dealsApportes: 13, caGenere: 202, contact: "non renseigné", statut: "actif" },
  { name: "KUKUZA AFRICA", type: "Autre", specialite: "Fournisseur — nature exacte non déterminable des données", since: "fournisseur actif", dealsApportes: 24, caGenere: 107, contact: "non renseigné", statut: "actif" },
  { name: "CFAO MOBILITY", type: "Autre", specialite: "Groupe CFAO — mobilité/équipements (hors cœur IT)", since: "fournisseur actif", dealsApportes: 18, caGenere: 122, contact: "non renseigné", statut: "actif" },
  { name: "HILANE TRANSIT", type: "Logistique / Transit", specialite: "Transit et dédouanement", since: "fournisseur actif", dealsApportes: 17, caGenere: 146, contact: "non renseigné", statut: "actif" },
  { name: "AGL (ex Bolloré Transport & Logistics CI)", type: "Logistique / Transit", specialite: "Transport et logistique", since: "fournisseur actif", dealsApportes: 8, caGenere: 63, contact: "non renseigné", statut: "actif" },
  { name: "DIGITAL DATA CAPTURE SOLUTIONS", type: "Distribution IT", specialite: "Solutions de capture de données", since: "fournisseur actif", dealsApportes: 6, caGenere: 80, contact: "non renseigné", statut: "actif" },
  { name: "EDEN CONSULTING", type: "Conseil", specialite: "Conseil (nature exacte non détaillée)", since: "fournisseur actif", dealsApportes: 2, caGenere: 75, contact: "non renseigné", statut: "actif" },
];

/**
 * Certifications par fournisseur, suivies par le service Marketing pour maintenir
 * le niveau de partenariat (Gold/Silver/Bronze). AUCUNE donnée réelle de certification
 * n'existe dans neurones.db (la table kb_certification est vide et concerne des personnes,
 * pas des fournisseurs) — ceci est un exemple illustratif en attendant un vrai suivi Marketing.
 */
export interface Certification {
  nom: string;
  statut: "Validée" | "À renouveler" | "À vérifier";
  echeance: string | null;
}

export const CERTIFICATIONS_FOURNISSEURS: Record<string, Certification[]> = {
  "POLARIS Distribution S.A.R.L": [
    { nom: "Cisco Gold Certified Partner", statut: "Validée", echeance: "2027-03-15" },
    { nom: "Fortinet Authorized Distributor", statut: "À renouveler", echeance: "2026-09-10" },
  ],
  "AITEK CI": [
    { nom: "Cisco Select Certified Partner", statut: "À renouveler", echeance: "2026-07-31" },
  ],
  "HIPERDIST LIMITED": [
    { nom: "Fortinet Platinum Partner", statut: "À renouveler", echeance: "2026-08-20" },
  ],
  "HIPERDIST AFRICA": [
    { nom: "Microsoft Solutions Partner — Modern Work", statut: "Validée", echeance: "2027-01-12" },
  ],
  "DIGITAL DATA CAPTURE SOLUTIONS": [
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

/** Niveau de partenariat déduit du montant commandé (règle, pas une donnée native Odoo). */
export function niveauPartenariat(caGenere: number): { label: string; color: string } {
  if (caGenere >= 500) return { label: "Gold", color: "var(--color-ai)" };
  if (caGenere >= 100) return { label: "Silver", color: "var(--color-good)" };
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
