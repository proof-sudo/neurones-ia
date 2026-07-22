import "server-only";

import { backendFetch } from "../backend";

// ---------- Types de la réponse /v1/clients/portfolio ----------

export interface ClientPortfolioItem {
  client: string;
  nb_dossiers: number;
  ca_total_xof: number;
  reste_a_encaisser_xof: number;
  backlog_xof: number;
  premiere_commande: string | null;
  derniere_commande: string | null;
  secteur: string | null;
  contact_email: string | null;
  telephone: string | null;
  dernier_projet: string | null;
  signaux: string[];
}

/** Portefeuille clients réel (table dossiers). Lève si le backend est indisponible. */
export async function fetchClientPortfolio(limit = 30): Promise<ClientPortfolioItem[]> {
  return backendFetch<ClientPortfolioItem[]>(`/v1/clients/portfolio?limit=${limit}`);
}

// ---------- Types de la réponse /v1/clients/dossiers ----------

export interface ClientDossier {
  ref: string;
  client: string;
  projet: string;
  commercial: string;
  etat: string;
  date_creation: string | null;
  date_fin: string | null;
  ca_provisoire: number;
  ca_definitif: number;
  marge_provisoire: number;
  marge_definitive: number;
  perc_marge_provisoire: number;
  perc_marge_definitive: number;
  montant_recu: number;
  reste_a_encaisser: number;
  backlog: number;
}
