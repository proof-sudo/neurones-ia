import type { ClientProfile } from "../types";

export const CLIENT_PROFILES: ClientProfile[] = [
  {
    name: "Orange Burkina Faso",
    since: "27 dossiers (2025-2026)",
    ca: "1 584 M FCFA",
    dossiers: "27",
    resteEncaisser: "0 M FCFA",
    backlog: "2 315 M FCFA",
    contact: "non renseigné",
    dernierProjet: "Formation Fortinet (avril 2026)",
    secteur: "Télécom",
    activite:
      "Filiale burkinabè de l'opérateur télécom Orange. Client historique multi-projets (formations, renouvellements de licences F5/Fortinet/RedHat) plutôt que gros projets d'infrastructure ponctuels.",
    historique: [
      { titre: "Formation Fortinet", periode: "avril 2026", statut: "draft" },
      { titre: "Renouvellement licence F5", periode: "avril 2026", statut: "draft" },
      { titre: "Abonnement annuel ADManager Plus", periode: "avril 2026", statut: "draft" },
      { titre: "Renouvellement licence RedHat", periode: "décembre 2025", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Contrat de maintenance groupé",
        rationale:
          "27 dossiers ouverts sur la période, très majoritairement des renouvellements de licences unitaires — les regrouper dans un contrat-cadre annuel réduirait la charge administrative des deux côtés.",
      },
      {
        service: "Suivi facturation",
        rationale:
          "Backlog de 2 315 M FCFA non facturé sur ce compte — à clarifier avec la Direction Financière avant qu'il ne devienne difficile à justifier.",
      },
    ],
  },
  {
    name: "MTN CI",
    since: "27 dossiers (2025-2026)",
    ca: "1 317 M FCFA",
    dossiers: "27",
    resteEncaisser: "354 M FCFA",
    backlog: "21 M FCFA",
    contact: "eric.ambeu@mtn.com · 46 46 46 00",
    dernierProjet: "MINIO subscription SIM registration (avril 2026)",
    secteur: "Télécom",
    activite:
      "Filiale ivoirienne de l'opérateur télécom MTN. Contact identifié (Eric Ambeu) contrairement à la plupart des autres comptes — relation commerciale plus structurée.",
    historique: [
      { titre: "MINIO subscription for SIM registration", periode: "avril 2026", statut: "draft" },
      { titre: "Support infra F5", periode: "novembre 2025", statut: "draft" },
      { titre: "Cisco Umbrella Security 2025", periode: "octobre 2025", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Reste à encaisser à relancer",
        rationale:
          "354 M FCFA restent à encaisser sur les dossiers actifs — montant significatif à prioriser dans les relances de facturation.",
      },
      {
        service: "Renforcement sécurité (Cisco Umbrella)",
        rationale:
          "Le projet Cisco Umbrella Security 2025 est un point d'entrée naturel pour proposer une extension cybersécurité plus large.",
      },
    ],
  },
  {
    name: "Société Générale Côte d'Ivoire",
    since: "58 dossiers (2025-2026)",
    ca: "1 294 M FCFA",
    dossiers: "58",
    resteEncaisser: "170 M FCFA",
    backlog: "-24 M FCFA",
    contact: "20 20 15 27",
    dernierProjet: "Contrat de maintenance applications 2026 (février 2026)",
    secteur: "Banque",
    activite:
      "Filiale ivoirienne du groupe bancaire Société Générale. Le compte le plus actif en nombre de dossiers (58) de tout le portefeuille — relation dense et récurrente.",
    historique: [
      { titre: "Contrat de maintenance applications 2026", periode: "février 2026", statut: "draft" },
      { titre: "Formation", periode: "décembre 2025", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Compte stratégique à structurer",
        rationale:
          "58 dossiers sur la période en fait le compte le plus dense du portefeuille — un interlocuteur commercial dédié et un point mensuel formel semblent justifiés vu le volume.",
      },
      {
        service: "Vérifier le solde négatif",
        rationale:
          "Le backlog apparaît légèrement négatif (-24 M FCFA), signe possible de facturation en avance sur la livraison — à vérifier avec la Direction Financière.",
      },
    ],
  },
  {
    name: "Orange BF",
    since: "13 dossiers (2025-2026)",
    ca: "1 000 M FCFA",
    dossiers: "13",
    resteEncaisser: "0 M FCFA",
    backlog: "1 096 M FCFA",
    contact: "non renseigné",
    dernierProjet: "non renseigné",
    secteur: "Télécom",
    activite:
      "Entité distincte d'« Orange Burkina Faso » dans le CRM (probable doublon ou filiale enregistrée séparément) — à rapprocher pour fiabiliser le suivi de ce compte.",
    historique: [
      { titre: "(historique à rapprocher avec Orange Burkina Faso)", periode: "2025-2026", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Fusion de fiche client à envisager",
        rationale:
          "« Orange BF » et « Orange Burkina Faso » semblent être le même client dupliqué dans le CRM — un rapprochement donnerait une vision consolidée plus fiable de la relation.",
      },
    ],
  },
  {
    name: "Kaydan Technology",
    since: "3 dossiers (2025-2026)",
    ca: "756 M FCFA",
    dossiers: "3",
    resteEncaisser: "21 M FCFA",
    backlog: "233 M FCFA",
    contact: "non renseigné",
    dernierProjet: "non renseigné",
    secteur: "IT/Revendeur",
    activite:
      "Peu de dossiers (3) pour un CA cumulé pourtant élevé (756 M FCFA) — probablement 1 à 2 projets de taille importante plutôt qu'une relation récurrente.",
    historique: [
      { titre: "(3 dossiers, détail projet non extrait)", periode: "2025-2026", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Compte à fort potentiel, peu suivi",
        rationale:
          "Ratio CA/nombre de dossiers très élevé — ce compte mériterait un suivi commercial renforcé pour transformer ce succès ponctuel en relation récurrente.",
      },
    ],
  },
  {
    name: "BICICI",
    since: "12 dossiers (2025-2026)",
    ca: "621 M FCFA",
    dossiers: "12",
    resteEncaisser: "244 M FCFA",
    backlog: "-64 M FCFA",
    contact: "non renseigné",
    dernierProjet: "Renouvellement Arbor (mai 2026)",
    secteur: "Banque",
    activite:
      "Banque ivoirienne (filiale BNP Paribas). Portefeuille de dossiers très orienté renouvellements de licences sécurité (Arbor, Check Point, F5) — client d'infrastructure réseau/sécurité récurrent.",
    historique: [
      { titre: "Renouvellement Arbor", periode: "mai 2026", statut: "draft" },
      { titre: "Check Point", periode: "mai 2026", statut: "draft" },
      { titre: "Renouvellement F5", periode: "décembre 2025", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Contrat pluriannuel de licences sécurité",
        rationale:
          "3 renouvellements de licences sécurité distincts en 6 mois (Arbor, Check Point, F5) — un contrat pluriannuel groupé simplifierait la gestion pour les deux parties.",
      },
      {
        service: "Relance du reste à encaisser",
        rationale: "244 M FCFA restent à encaisser, à prioriser dans les relances.",
      },
    ],
  },
  {
    name: "Atlantic Business International (ABI)",
    since: "42 dossiers (2025-2026)",
    ca: "599 M FCFA",
    dossiers: "42",
    resteEncaisser: "200 M FCFA",
    backlog: "189 M FCFA",
    contact: "non renseigné",
    dernierProjet: "Renouvellement F5 (novembre 2025)",
    secteur: "Groupe industriel/agro",
    activite:
      "Groupe panafricain diversifié (agro-industrie, distribution). 42 dossiers sur la période — 2e compte le plus actif du portefeuille par volume, mais CA cumulé plus modeste que le nombre de dossiers ne le suggère.",
    historique: [
      { titre: "Renouvellement F5", periode: "novembre 2025", statut: "draft" },
      { titre: "Formation", periode: "août 2025", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Revoir le panier moyen",
        rationale:
          "42 dossiers pour 599 M FCFA (≈ 14 M FCFA/dossier en moyenne) — panier moyen faible comparé à d'autres comptes ; explorer des offres à plus forte valeur ajoutée.",
      },
    ],
  },
  {
    name: "DSIS-Ministère de la Santé",
    since: "2 dossiers (2025-2026)",
    ca: "512 M FCFA",
    dossiers: "2",
    resteEncaisser: "0 M FCFA",
    backlog: "434 M FCFA",
    contact: "non renseigné",
    dernierProjet: "non renseigné",
    secteur: "Secteur public",
    activite:
      "Direction des systèmes d'information de la santé (Ministère). Seulement 2 dossiers mais un CA élevé et un backlog important — typique d'un marché public de grande ampleur.",
    historique: [
      { titre: "(2 dossiers, probable marché public)", periode: "2025-2026", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Sécuriser la facturation du backlog",
        rationale:
          "434 M FCFA de backlog non facturé sur seulement 2 dossiers — vérifier en priorité l'état d'avancement contractuel avant tout nouvel engagement sur ce compte.",
      },
    ],
  },
  {
    name: "Banque Postale Burkina Faso (BPBF)",
    since: "11 dossiers (2025-2026)",
    ca: "421 M FCFA",
    dossiers: "11",
    resteEncaisser: "0 M FCFA",
    backlog: "375 M FCFA",
    contact: "non renseigné",
    dernierProjet: "non renseigné",
    secteur: "Banque",
    activite:
      "Établissement bancaire postal burkinabè. 11 dossiers sur la période, aucun reste à encaisser signalé mais un backlog non facturé notable.",
    historique: [
      { titre: "(11 dossiers, détail projet non extrait)", periode: "2025-2026", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Clôturer le backlog",
        rationale:
          "375 M FCFA de backlog non facturé à traiter — probablement des prestations déjà livrées mais pas encore facturées.",
      },
    ],
  },
  {
    name: "Coris Holding Burkina Faso",
    since: "21 dossiers (2025-2026)",
    ca: "331 M FCFA",
    dossiers: "21",
    resteEncaisser: "0 M FCFA",
    backlog: "1 266 M FCFA",
    contact: "non renseigné",
    dernierProjet: "non renseigné",
    secteur: "Banque/Holding",
    activite:
      "Groupe financier holding burkinabè. Backlog non facturé le plus élevé du top 10 (1 266 M FCFA) rapporté à un CA cumulé plus modeste — écart à investiguer en priorité.",
    historique: [
      { titre: "(21 dossiers, détail projet non extrait)", periode: "2025-2026", statut: "draft" },
    ],
    recommandations: [
      {
        service: "Audit prioritaire du backlog",
        rationale:
          "Backlog de 1 266 M FCFA pour seulement 331 M FCFA de CA commandé sur la période — écart important qui mérite une vérification avec la Direction Financière avant toute nouvelle proposition commerciale.",
      },
    ],
  },
];
