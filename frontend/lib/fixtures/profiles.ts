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
  },
  {
    role: "dir_commercial",
    nom: "Direction Commerciale",
    email: "pbourron@neuronestech.com",
    icon: "◧",
    initiales: "DC",
    focus: "Pilotage commercial complet : pipeline, clients, offres.",
  },
  {
    role: "dir_operations",
    nom: "Direction des Opérations",
    email: "psoro@neuronestech.com",
    icon: "▥",
    initiales: "DO",
    focus: "Exécution des projets, appels d'offres et fournisseurs.",
  },
  {
    role: "presale",
    nom: "Équipe Avant-Vente",
    email: "presales@neuronestech.com",
    icon: "◎",
    initiales: "AV",
    focus:
      "Qualification des appels d'offres et préparation des réponses techniques.",
  },
  {
    role: "dir_financier",
    nom: "Direction Financière",
    email: "cdjereke@neuronestech.com",
    icon: "◒",
    initiales: "DF",
    focus: "Trésorerie, marges et recouvrement.",
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
