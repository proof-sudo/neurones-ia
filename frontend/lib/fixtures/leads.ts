import type { Lead, Qualification } from "../types";

export const QUAL_LABEL: Record<Qualification, string> = {
  hot: "Chaud",
  warm: "Tiède",
  cold: "Froid",
};

export const LEADS: Lead[] = [
  {
    ent: "KAYDAN",
    ville: "non renseigné",
    tel: "non renseigné",
    val: 498,
    qual: "warm",
    com: "Jacques Marie DRIGBE",
    notes:
      "Opportunité « Acquisition d'équipements », créée le 02/07/2026. Probabilité renseignée à 50 % — à qualifier plus précisément.",
  },
  {
    ent: "PROSUMA",
    ville: "Abidjan",
    tel: "21 25 34 16",
    val: 0,
    qual: "cold",
    com: "Jacques Marie DRIGBE",
    notes:
      "Opportunité « Refonte réseau Filiale PROSUMA », créée le 02/07/2026. Montant pas encore estimé (probabilité 10 %).",
  },
  {
    ent: "BICICI",
    ville: "Abidjan - Plateau",
    tel: "non renseigné",
    val: 0,
    qual: "cold",
    com: "Segui Mireille KOUADIO",
    notes:
      "Opportunité « Contrat de l'infra réseau et sécurité (switch / F5 / ISE / Check Point Forti Arbor) », créée le 08/07/2026. Montant à chiffrer.",
  },
  {
    ent: "CONSEIL CAFE CACAO",
    ville: "non renseigné",
    tel: "non renseigné",
    val: 0,
    qual: "cold",
    com: "Agneroh Marc Antoine EGUE",
    notes:
      "3 opportunités ouvertes le même jour (02/07/2026) : déménagement salle serveur, contrat de maintenance, acquisition de 2 switches Cisco.",
  },
  {
    ent: "BELIFE",
    ville: "non renseigné",
    tel: "non renseigné",
    val: 5,
    qual: "cold",
    com: "Jacques Marie DRIGBE",
    notes:
      "Opportunité « Acquisition d'outil de supervision », créée le 02/07/2026. Probabilité à 0 % — contact très récent, pas encore qualifié.",
  },
];
