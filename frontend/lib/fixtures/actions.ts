export type Priority = "high" | "medium" | "low";

export interface ActionSuggestion {
  priority: Priority;
  category: string;
  title: string;
  desc: string;
  cta: string;
  /** Vue cible du bouton d'action */
  view: string;
  /** Client à ouvrir (query param) le cas échéant */
  client?: string;
}

export const ACTION_SUGGESTIONS: ActionSuggestion[] = [
  { priority: "high", category: "Recouvrement", title: "Escalader les impayés BAD", desc: "1 682 M FCFA d'impayés cumulés sur 3 factures, dont 756 M FCFA en souffrance depuis 444 jours. Signalé dans le briefing IA de la semaine.", cta: "Voir le workflow", view: "workflow" },
  { priority: "high", category: "Risque", title: "Purger l'opportunité Orange Côte d'Ivoire — Refresh WAN", desc: "3 673 M FCFA en stade Qualification depuis 2 612 jours (plus de 7 ans) — quasi certainement obsolète, jamais clôturée.", cta: "Voir le pipeline", view: "pipeline" },
  { priority: "high", category: "Qualité de données", title: "Fusionner les fiches Orange BF / Orange Burkina Faso", desc: "Ces deux fiches clients semblent être le même compte dupliqué dans le CRM, faussant le suivi réel de la relation.", cta: "Voir le client", view: "clients", client: "Orange BF" },
  { priority: "medium", category: "Recouvrement", title: "Relancer MTN CI sur le reste à encaisser", desc: "354 M FCFA restent à encaisser sur les dossiers actifs — montant significatif à prioriser.", cta: "Voir le client", view: "clients", client: "MTN CI" },
  { priority: "medium", category: "Développement", title: "Accélérer la qualification — KAYDAN", desc: "Lead à 498 M FCFA avec 50 % de probabilité déjà renseignée — le mieux qualifié des 5 leads réels actuels.", cta: "Voir le lead", view: "leads" },
  { priority: "medium", category: "Audit interne", title: "Vérifier le backlog Coris Holding Burkina Faso", desc: "1 266 M FCFA de backlog non facturé pour seulement 331 M FCFA de CA commandé sur la période — écart important à clarifier avant toute nouvelle offre.", cta: "Voir le client", view: "clients", client: "Coris Holding Burkina Faso" },
  { priority: "medium", category: "Appel d'offre", title: "Clarifier le périmètre IT — AMI AT2ER (Togo)", desc: "Centrale solaire 42 MWc : potentiel sur le monitoring SCADA et la cybersécurité industrielle, à confirmer sous 2 jours (échéance 17/07/2026).", cta: "Voir la veille AO", view: "veille-ao" },
  { priority: "medium", category: "Développement", title: "Structurer le compte Kaydan Technology", desc: "756 M FCFA de CA sur seulement 3 dossiers — ratio très élevé qui suggère un compte à fort potentiel, aujourd'hui peu suivi.", cta: "Voir le client", view: "clients", client: "Kaydan Technology" },
  { priority: "low", category: "Cross-sell", title: "Proposer un contrat pluriannuel de sécurité — BICICI", desc: "3 renouvellements de licences sécurité distincts en 6 mois (Arbor, Check Point, F5) — un contrat groupé simplifierait la gestion.", cta: "Voir le client", view: "clients", client: "BICICI" },
  { priority: "low", category: "Qualité de données", title: "Nettoyer les opportunités obsolètes du pipeline", desc: "1 048 opportunités ouvertes (34 % du pipeline) ont plus d'un an d'ancienneté et faussent la lecture du pipeline réel.", cta: "Voir le pipeline", view: "pipeline" },
];

/** Statistiques d'en-tête (les 4 catégories mises en avant dans le mockup). */
export const ACTION_STAT_LABELS: { key: string; label: string }[] = [
  { key: "Relance", label: "Relances à traiter" },
  { key: "Risque", label: "Opportunités à risque" },
  { key: "Cross-sell", label: "Ventes complémentaires" },
  { key: "Appel d'offre", label: "Appels d'offres urgents" },
];

/** Onglets de filtre. */
export const ACTION_FILTERS = ["Toutes", "Relance", "Risque", "Cross-sell", "Appel d'offre"];
