import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/partners/top ----------

export interface SupplierOrder {
  ref: string;
  montant_xof: number;
  date: string | null;
}

export interface Supplier {
  name: string;
  montant_total_xof: number;
  nb_commandes: number;
  derniere_commande: string | null;
  premiere_commande: string | null;
  montant_moyen_xof: number;
  montant_engage_12m_xof: number;
  nb_commandes_12m: number;
  commandes_recentes: SupplierOrder[];
  /** Les 5 indicateurs différenciants (cf. SupplierIntelligence) — null si la synchro
   * Odoo correspondante (factures fournisseurs, fiche crédit) n'a pas encore de données
   * pour ce fournisseur, jamais inventé côté frontend. */
  intelligence?: SupplierIntelligence | null;
}

/** Fournisseurs réels (purchase_orders). Lève si le backend est indisponible. */
export async function fetchTopSuppliers(limit = 20): Promise<Supplier[]> {
  return backendFetch<Supplier[]>(`/v1/partners/top?limit=${limit}`);
}

// ---------- Types de la réponse /v1/partners/intelligence ----------

/** 5 indicateurs différenciants (pas la répétition de ce qu'Odoo montre déjà) :
 * crédit/consommation, cash prévisionnel 30-60-90j, marge de sous-traitance liée
 * à une mission réelle, fiabilité de paiement réelle, risque de rupture (proxy). */
export interface SupplierIntelligence {
  name: string;
  montant_total_xof: number;
  nb_commandes: number;
  taux_dependance_pct: number;
  credit_limit_xof: number | null;
  encours_du_xof: number;
  taux_consommation_credit_pct: number | null;
  cash_30j_xof: number;
  cash_60j_xof: number;
  cash_90j_xof: number;
  cash_plus_90j_xof: number;
  marge_sous_traitance_xof: number;
  nb_dossiers_lies: number;
  payment_term_name: string | null;
  payment_term_days: number | null;
  retard_moyen_jours: number | null;
  dossiers_a_risque_fournisseur_unique: number;
}

/** Lève si le backend est indisponible. */
export async function fetchSupplierIntelligence(limit = 20): Promise<SupplierIntelligence[]> {
  return backendFetch<SupplierIntelligence[]>(`/v1/partners/intelligence?limit=${limit}`);
}
