import type { Tender } from "../types";

export const TENDERS: Tender[] = [
  {
    name: "AO Automatisation",
    client: "CNPS",
    deadline: "15 jours",
    urgency: "soon",
    progress: 10,
    status: "Transmise",
    qualified: true,
    cdcReceived: false,
    montant: "286 M FCFA",
    commercial: "Segui Mireille KOUADIO",
    checklist: [
      "Cahier des charges à ingérer (table kb_ao vide — aucun CDC réel disponible pour l'instant)",
      "Seul appel d'offre du portefeuille avec une échéance encore valide (30/07/2026)",
    ],
  },
  {
    name: "AO : fourniture de services",
    client: "Banque Africaine de Développement (BAD)",
    deadline: "dépassée depuis 2 408 jours",
    urgency: "urgent",
    progress: 0,
    status: "Proposition (obsolète)",
    qualified: true,
    cdcReceived: false,
    montant: "2 040 M FCFA",
    commercial: "Koffi Paulin APEDO",
    checklist: [
      "Échéance réelle dépassée depuis fin 2019 — dossier probablement abandonné mais jamais clôturé dans le CRM",
      "Recommandation : marquer perdu/annulé ou vérifier s'il existe une suite non tracée",
    ],
  },
  {
    name: "AO ASSI Bénin : Réseau",
    client: "ASSI Bénin",
    deadline: "dépassée depuis 2 400 jours",
    urgency: "urgent",
    progress: 0,
    status: "Qualification (obsolète)",
    qualified: true,
    cdcReceived: false,
    montant: "900 M FCFA",
    commercial: "Koffi Paulin APEDO",
    checklist: [
      "Échéance réelle dépassée depuis fin 2019 — dossier probablement abandonné mais jamais clôturé dans le CRM",
    ],
  },
  {
    name: "Appel d'offre BIDC Togo",
    client: "BIDC",
    deadline: "dépassée depuis 2 784 jours",
    urgency: "urgent",
    progress: 0,
    status: "New (obsolète)",
    qualified: true,
    cdcReceived: false,
    montant: "558 M FCFA",
    commercial: "Koffi Paulin APEDO",
    checklist: [
      "Échéance réelle dépassée depuis fin 2018 — dossier probablement abandonné mais jamais clôturé dans le CRM",
    ],
  },
  {
    name: "AO N°11 Équipements Cisco",
    client: "BEAC",
    deadline: "dépassée depuis 2 618 jours",
    urgency: "urgent",
    progress: 0,
    status: "Proposition (obsolète)",
    qualified: true,
    cdcReceived: false,
    montant: "211 M FCFA",
    commercial: "Koffi Paulin APEDO",
    checklist: [
      "Échéance réelle dépassée depuis mi-2019 — dossier probablement abandonné mais jamais clôturé dans le CRM",
    ],
  },
];

export type VerdictStatut = "go" | "conditionnel" | "no-go";
export type RiskLevel = "high" | "medium" | "low";

export interface CdcAnalysis {
  name: string;
  client: string;
  excerpt: string;
  exigences: string[];
  criteres: { nom: string; poids: number }[];
  risques: { level: RiskLevel; text: string }[];
  documentsManquants: string[];
  recommandation: { statut: VerdictStatut; score: number; synthese: string };
}

/** Analyse CDC pré-chargée (le seul dossier avec échéance valide : CNPS). */
export const TENDERS_CDC: CdcAnalysis[] = [
  {
    name: "AO Automatisation",
    client: "CNPS",
    excerpt:
      "Aucun cahier des charges réel n'a été ingéré pour cet appel d'offre — la table kb_ao (prévue pour stocker le texte et les métadonnées extraites des CDC) est actuellement vide dans l'export neurones.db. Ce qui est réellement connu : opportunité « AO Automatisation » pour le client CNPS, montant estimé 286 M FCFA, probabilité 20 %, échéance de remise le 30/07/2026 (dans 15 jours), portée par Segui Mireille KOUADIO. Collez ici le texte réel du cahier des charges dès qu'il sera disponible pour lancer une analyse fiable.",
    exigences: [
      "Aucune exigence extraite — CDC non ingéré. Collez le texte réel ci-contre puis relancez l'analyse.",
    ],
    criteres: [{ nom: "Non disponible (CDC non ingéré)", poids: 100 }],
    risques: [
      {
        level: "medium",
        text: "Aucun cahier des charges réel disponible pour ce dossier — l'analyse ci-dessous ne peut pas encore être fiable. Il s'agit du seul appel d'offre du portefeuille dont l'échéance n'est pas dépassée : à traiter en priorité pour récupérer le vrai CDC.",
      },
    ],
    documentsManquants: [
      "Cahier des charges complet (à ingérer dans kb_ao ou coller manuellement ci-contre)",
    ],
    recommandation: {
      statut: "conditionnel",
      score: 20,
      synthese:
        "Impossible de donner une recommandation GO/NO-GO fiable sans le texte réel du cahier des charges. Priorité : récupérer le CDC de la CNPS avant l'échéance du 30/07/2026 (15 jours restants) et le coller dans la zone de texte pour relancer une analyse complète.",
    },
  },
];
