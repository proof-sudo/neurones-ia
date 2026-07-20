export interface Decision {
  title: string;
  context: string;
  type: string;
  statut: string;
  owner: string;
  createdBy: string;
  createdAt: string;
}

export const DECISIONS: Decision[] = [
  {
    title: "GO/NO-BID sur AO équipements réalité virtuelle (Burkina, AMI BOAD)",
    context:
      "Signal veille 45/100 : vérifier si le cahier des charges inclut un volet IT/intégration.",
    type: "GO_NOBID",
    statut: "en_cours",
    owner: "Avant-vente",
    createdBy: "psoro@neuronestech.com",
    createdAt: "12/07/2026",
  },
];

export interface Briefing {
  periode: string;
  idee: string;
  chiffres: string[];
  risques: string[];
  actions: string[];
  statut: string;
  reviewedBy: string;
}

export const BRIEFINGS: Briefing[] = [
  {
    periode: "Semaine du 12/07/2026 (v1)",
    idee: "Neurones Technologies est en situation de crise de trésorerie structurelle : avec -25,8 % de CA facturé YTD et 10,86 Md FCFA d'impayés échus sur 842 factures, le recouvrement est devenu la priorité absolue avant toute décision de croissance.",
    chiffres: [
      "CA facturé YTD : 3,79 Md FCFA (-25,8 % vs N-1)",
      "Commandes YTD : 4,15 Md FCFA (-30,8 % vs N-1)",
      "Marge provisoire : 38,8 % (1,11 Md FCFA)",
      "Impayés échus : 10,86 Md FCFA sur 842 factures",
      "Pipeline pondéré : 60,59 Md FCFA sur 5 370 opportunités",
    ],
    risques: [
      "Rupture de trésorerie opérationnelle : impayés échus = 2,86x le CA facturé YTD.",
      "Concentration client critique : BAD seule = 1 682 M FCFA d'impayés, dont 756 M FCFA à 444 jours.",
      "Dégradation du pipeline : prises de commande en recul plus rapide (-30,8 %) que le CA (-25,8 %).",
    ],
    actions: [
      "Activer une cellule de recouvrement dédiée BAD (1 682 M FCFA) — Responsable : DG + DAF.",
      "Revue d'urgence du portefeuille Orange CI + Liberia (587 M FCFA échus) — Responsable : DAF + Dir. Commerciale.",
      "Statuer sous la semaine sur le GO/NO-BID Burkina — Responsable : Avant-vente + DG.",
    ],
    statut: "draft",
    reviewedBy: "(non relu)",
  },
  {
    periode: "Semaine du 12/07/2026 (v2)",
    idee: "Neurones Technologies est en crise de trésorerie structurelle : avec -25,8 % de CA YTD et 10,86 Md FCFA d'impayés échus sur 842 factures, le recouvrement est l'urgence absolue de la semaine — avant toute décision de bid ou d'investissement commercial.",
    chiffres: [
      "Impayés échus : 10,86 Md FCFA (842 factures)",
      "BAD : 1,682 Md FCFA dont 756 M FCFA à 444 jours",
      "Orange CI : 314 M FCFA à 569 jours · Orange Liberia : 273 M FCFA à 833 jours",
      "Prises de commande : -30,8 % YTD à 4,15 Md FCFA",
      "Pipeline : 60,59 Md FCFA sur 5 370 opportunités",
    ],
    risques: [
      "Provision pour créances douteuses imminente sur la BAD.",
      "Rupture de trésorerie opérationnelle si le recouvrement reste bloqué.",
      "Perte d'opportunités UEMOA par inaction sur le GO/NO-BID Burkina (score 72/100).",
    ],
    actions: [
      "Escalade DG directe sur la BAD, mise en demeure formelle — Responsable : DG + DAF.",
      "Plan de recouvrement d'urgence Orange CI/Liberia sous 5 jours — Responsable : DAF + Dir. Commercial.",
      "Recommandation chiffrée GO/NO-BID Burkina avant vendredi — Responsable : Avant-vente.",
      "Identifier le lauréat du DP RSP 49/2025 pour partenariat/sous-traitance — Responsable : Dir. Commercial.",
    ],
    statut: "draft",
    reviewedBy: "(non relu)",
  },
];
