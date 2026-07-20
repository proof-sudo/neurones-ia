import type { Profile, Role } from "../types";

/** Profils réels (table users) — port du mockup. */
export const PROFILES: Profile[] = [
  {
    role: "admin",
    nom: "Boyer Othniel Néhémie",
    email: "oboyer@neuronestech.com",
    icon: "⚙",
    initiales: "BN",
    focus:
      "Vue complète sur l'ensemble de la plateforme : données, utilisateurs et configuration.",
  },
  {
    role: "dg",
    nom: "Direction Générale",
    email: "jmkouadio@neuronestech.com",
    icon: "◆",
    initiales: "DG",
    focus: "Pilotage stratégique de l'entreprise.",
    ai: "Priorité réelle cette semaine : 10,86 Md FCFA d'impayés échus et une décision GO/NO-BID en attente (briefing IA).",
  },
  {
    role: "dir_commercial",
    nom: "Direction Commerciale",
    email: "pbourron@neuronestech.com",
    icon: "◧",
    initiales: "DC",
    focus: "Pilotage commercial complet : pipeline, clients, offres.",
    ai: "Pipeline réel de 107 677 M FCFA sur 3 050 opportunités, dont 34 % obsolètes (>1 an) à nettoyer en priorité.",
  },
  {
    role: "dir_operations",
    nom: "Direction des Opérations",
    email: "psoro@neuronestech.com",
    icon: "▥",
    initiales: "DO",
    focus: "Exécution des projets, appels d'offres et fournisseurs.",
    ai: "5 appels d'offres réels à qualifier ou clôturer, dont 4 avec échéance déjà dépassée dans le CRM.",
  },
  {
    role: "presale",
    nom: "Équipe Avant-Vente",
    email: "presales@neuronestech.com",
    icon: "◎",
    initiales: "AV",
    focus:
      "Qualification des appels d'offres et préparation des réponses techniques.",
    ai: "1 décision GO/NO-BID en attente et 1 seul AO du portefeuille avec échéance encore valide (CNPS, 15 jours).",
  },
  {
    role: "dir_financier",
    nom: "Direction Financière",
    email: "cdjereke@neuronestech.com",
    icon: "◒",
    initiales: "DF",
    focus: "Trésorerie, marges et recouvrement.",
    ai: "Alerte réelle : impayés échus (10,86 Md FCFA) représentent 2,86× le CA facturé YTD — recouvrement prioritaire.",
  },
  {
    role: "commercial",
    nom: "Commercial",
    email: "sales@neuronestech.com",
    icon: "◈",
    initiales: "CO",
    focus: "Suivi quotidien des leads, clients et opportunités.",
  },
];

export function getProfile(role: Role): Profile | undefined {
  return PROFILES.find((p) => p.role === role);
}
