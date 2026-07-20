import type { VeilleAO } from "../types";

/** Fréquences de collecte automatique (valeur en secondes → libellé). */
export const AO_FREQUENCIES: { value: number; label: string }[] = [
  { value: 3600, label: "Toutes les heures" },
  { value: 21600, label: "Toutes les 6 heures" },
  { value: 86400, label: "Quotidienne" },
  { value: 604800, label: "Hebdomadaire" },
];

export const VEILLE_AO: VeilleAO[] = [
  {
    id: "ao1",
    name: "Résultats DP N° RSP 49/2025 — Système de suivi-évaluation PDIW-CI",
    organisme: "PDIW-CI (projet gouvernemental, Côte d'Ivoire)",
    secteur: "Secteur public",
    source: "Banque mondiale — avis de passation (CI)",
    montant: "non communiqué",
    deadline: "résultats déjà publiés (à traiter avant fin juillet 2026)",
    match: 75,
    reason:
      "Appel d'offre fermé mais résultats publiés — identifier le lauréat pour une opportunité de partenariat ou sous-traitance en développement/intégration.",
  },
  {
    id: "ao2",
    name: "AOOR N°2026-005/MESRI — Laboratoire de réalité virtuelle PCEP-UV/BF",
    organisme: "MESRI / PCEP-UV (Burkina Faso)",
    secteur: "Éducation / Secteur public",
    source: "UEMOA — marchés publics",
    montant: "non communiqué",
    deadline: "dans 14 jours (29/07/2026)",
    match: 72,
    reason:
      "Opportunité d'intégration IT, infrastructure réseau et support technique pour un établissement public UEMOA — composante technique à qualifier avec le maître d'ouvrage.",
  },
  {
    id: "ao3",
    name: "AMI International N°005/AT2ER — Supervision centrale solaire Awandjelo (42 MWc)",
    organisme: "AT2ER (Togo)",
    secteur: "Énergie",
    source: "BOAD — appels d'offres",
    montant: "non communiqué",
    deadline: "dans 2 jours (17/07/2026)",
    match: 45,
    reason:
      "Infrastructure énergétique majeure nécessitant supervision/contrôle — potentiel de sous-traitance sur le monitoring SCADA et la cybersécurité industrielle, à confirmer sur le périmètre exact.",
  },
  {
    id: "ao4",
    name: "AMI N°2026-001/MESRI/SG/DMP — Audit technique Université Virtuelle du Burkina Faso",
    organisme: "MESRI (Burkina Faso)",
    secteur: "Éducation / Secteur public",
    source: "UEMOA — marchés publics",
    montant: "non communiqué",
    deadline: "échéance dépassée depuis 1 jour (14/07/2026)",
    match: 55,
    reason:
      "Projet digital majeur en zone UEMOA nécessitant un audit technique IT — échéance de manifestation d'intérêt tout juste dépassée, à vérifier si une prolongation existe.",
  },
  {
    id: "ao5",
    name: "AOON ARAA/AIC-BOAD/2026/AON/010 — Forages solaires et irrigation (Togo)",
    organisme: "ARAA / BOAD (Togo)",
    secteur: "Agriculture / Énergie",
    source: "BOAD — appels d'offres",
    montant: "non communiqué",
    deadline: "échéance dépassée depuis 40 jours (05/06/2026)",
    match: 40,
    reason:
      "Secteur agricole peu aligné avec le cœur de métier IT — pertinence uniquement si un volet télémétrie/IT/cloud existe dans le cahier des charges, à vérifier avant d'investir du temps.",
  },
];

/** Signaux supplémentaires « découverts » lors d'une collecte manuelle/auto. */
export const EXTRA_AO_POOL: VeilleAO[] = [
  {
    id: "ao6",
    name: "AOON ARAA/AIC-BOAD/2026/AON/006 — Forages solaires et irrigation (Bénin)",
    organisme: "ARAA / BOAD (Bénin)",
    secteur: "Agriculture / Énergie",
    source: "BOAD — appels d'offres",
    montant: "non communiqué",
    deadline: "échéance dépassée",
    match: 35,
    reason:
      "Variante du signal Togo (même type de marché) — secteur agricole hors cœur de métier, pertinence IT à vérifier au cas par cas.",
  },
  {
    id: "ao7",
    name: "AMI N°001/PI/2026/APRODAT/UGP-AK/PRMP/PTA-TOGO — Ingénieur infrastructures rurales",
    organisme: "APRODAT / PTA-TOGO",
    secteur: "Infrastructure rurale",
    source: "BOAD — appels d'offres",
    montant: "non communiqué",
    deadline: "échéance dépassée",
    match: 35,
    reason:
      "Mission de conseil en infrastructures rurales — pas de composante IT identifiée dans le résumé, à qualifier avant tout investissement de temps commercial.",
  },
];
