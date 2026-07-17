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
