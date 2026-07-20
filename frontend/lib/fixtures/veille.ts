import type {
  DiscardedSignal,
  ProspectSuggestion,
  VeilleReco,
  VeilleSource,
} from "../types";

export const VEILLE_SOURCES: VeilleSource[] = [
  {
    name: "DGMP Côte d'Ivoire",
    url: "dgmp.gouv.ci/fr/avis-appels-offres",
    zone: "Côte d'Ivoire",
    keywords: "Réseau, infrastructure, sécurité, cloud, ISO 27001, EDR/XDR, SOC",
    lastScan: "14/07/2026",
  },
  {
    name: "BOAD Appels d'Offres",
    url: "boad.org/appels-doffres",
    zone: "UEMOA",
    keywords: "Informatique, système d'information, réseau, infrastructure",
    lastScan: "14/07/2026",
  },
  {
    name: "BAD — Avis d'acquisitions",
    url: "afdb.org (passation des marchés)",
    zone: "Afrique (BAD)",
    keywords: "Informatique, digitalisation, réseau, datacenter, logiciel",
    lastScan: "14/07/2026",
  },
  {
    name: "Banque mondiale — Avis (CI)",
    url: "projects.banquemondiale.org",
    zone: "Côte d'Ivoire",
    keywords: "Informatique, digital, réseau, technologie, équipement",
    lastScan: "14/07/2026",
  },
  {
    name: "UEMOA — Marchés publics",
    url: "marchespublics.uemoa.int/avis",
    zone: "UEMOA",
    keywords: "Informatique, système d'information, réseau, logiciel",
    lastScan: "14/07/2026",
  },
];

export const DISCARDED_SIGNALS: DiscardedSignal[] = [
  {
    titre: "AMI recrutement BET — surveillance travaux lycées techniques (Bénin)",
    motif: "Génie civil/construction, hors cœur de métier IT de Neurones Technologies.",
  },
  {
    titre: "AMI consultant agriculture intelligente (Guinée-Bissau)",
    motif: "Secteur agricole, hors périmètre IT et hors zone UEMOA prioritaire.",
  },
  {
    titre: "AO forages solaires et irrigation — Savanes/Kara (Togo)",
    motif: "Infrastructure hydraulique/agricole, aucun composant numérique identifié.",
  },
  {
    titre: "AO bassins de collecte des eaux — Atacora/Alibori (Bénin)",
    motif: "Infrastructure hydraulique, aucun volet cloud/cybersécurité/réseau détecté.",
  },
  {
    titre: "AMI sécurité incendie — Siège BOAD",
    motif: "Prestation de sécurité physique, sans lien avec les offres IT de Neurones.",
  },
];

export const VEILLE_RECOS: VeilleReco[] = [
  {
    titre: "Ajouter un champ « concurrent identifié » sur les opportunités perdues",
    texte:
      "Aujourd'hui, aucune cause de perte ni concurrent n'est tracé dans Odoo sur les 1 414 opportunités perdues. Ajouter ce champ (et le rendre obligatoire à la clôture en « Perdu ») permettrait, dès le prochain trimestre, de faire apparaître ici un vrai classement gagné/perdu par concurrent — impossible à reconstituer a posteriori sur les données actuelles.",
    effort: "Faible — évolution de formulaire CRM existant",
  },
  {
    titre: "Extraire l'attributaire sur les résultats d'appels d'offres déjà scrapés",
    texte:
      "Vos 5 sources de veille (BOAD, BAD, Banque Mondiale, UEMOA, DGMP) publient aussi des résultats d'attribution, pas seulement des avis — un exemple réel existe déjà dans vos données (« Résultats d'évaluation des propositions techniques — RSP 49/2025 »). Étendre l'extraction IA existante pour capter le nom du lauréat sur ces pages ferait apparaître de vrais concurrents qui remportent des marchés dans votre secteur, sans construire de nouvel outil.",
    effort: "Moyen — extension du pipeline de veille existant, pas un nouveau système",
  },
];

/** Secteurs proposés dans le filtre Veille Client. */
export const VEILLE_CLIENT_SECTEURS = [
  "Télécom",
  "Banque / Finance",
  "Secteur public",
  "Assurance",
  "Industrie / Agro-industrie",
] as const;

/** Base locale de suggestions de prospects (repli sans IA). */
export const PROSPECTS_FALLBACK: ProspectSuggestion[] = [
  {
    nom: "Opérateurs télécom régionaux (hors portefeuille actuel)",
    secteur: "Télécom",
    raison:
      "Neurones travaille déjà avec Orange (CI/BF) et MTN CI sur du réseau Cisco et de la sécurité — d'autres opérateurs ou MVNO de la zone UEMOA ont probablement des besoins similaires.",
    projet:
      "Audit réseau + proposition de renouvellement de licences sécurité, sur le modèle BICICI/Orange.",
  },
  {
    nom: "Banques et établissements financiers non encore clients",
    secteur: "Banque / Finance",
    raison:
      "Société Générale CI, BICICI et Banque Postale BF sont des clients réels et actifs — d'autres banques de la zone (filiales de groupes panafricains) ont les mêmes contraintes réseau/sécurité.",
    projet:
      "Proposition de contrat pluriannuel de licences sécurité (Check Point, F5, Arbor), sur le modèle BICICI.",
  },
  {
    nom: "Institutions publiques et ministères (hors DSIS déjà client)",
    secteur: "Secteur public",
    raison:
      "DSIS-Ministère de la Santé est déjà client sur des marchés publics de grande ampleur — d'autres ministères ou directions publiques passent par les mêmes procédures d'appel d'offres (BOAD, Banque Mondiale, UEMOA) déjà surveillées en Veille AO.",
    projet:
      "Réponse à appel d'offre infrastructure/réseau, en s'appuyant sur la référence DSIS.",
  },
  {
    nom: "Compagnies d'assurance régionales",
    secteur: "Assurance",
    raison:
      "Secteur proche de la banque (mêmes contraintes réglementaires et de sécurité des données), non représenté dans le portefeuille actuel malgré l'expertise démontrée en cybersécurité.",
    projet:
      "Audit de sécurité des données clients + mise en conformité, en capitalisant sur les références bancaires existantes.",
  },
  {
    nom: "Groupes agro-industriels et de distribution",
    secteur: "Industrie / Agro-industrie",
    raison:
      "Atlantic Business International (ABI) est déjà client sur ce profil (42 dossiers) — d'autres groupes agro-industriels de la sous-région ont des besoins similaires en infrastructure réseau multi-sites.",
    projet:
      "Infrastructure réseau multi-sites, sur le modèle du deal réel avec Kelvin Manufacturing (pipeline).",
  },
];
