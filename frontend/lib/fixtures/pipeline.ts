import type { KanbanData } from "../types";

/** Ordre des colonnes du kanban (le même que le mockup). */
export const KANBAN_STAGES = [
  "Prospection",
  "Qualification",
  "Montage",
  "Transmise",
  "Proposition",
  "Négociation",
  "Contractualisation",
] as const;

export const KANBAN_DATA: KanbanData = {
  Prospection: [
    { name: "Câblage réseaux", client: "CNSS Burkina", val: "593 M FCFA", prob: 10, com: "Romuald HIEN", age: "2 579 jours", risk: true },
    { name: "Appel d'offre BIDC Togo", client: "BIDC", val: "558 M FCFA", prob: 10, com: "Koffi Paulin APEDO", age: "2 894 jours", risk: true },
  ],
  Qualification: [
    { name: "Refresh WAN", client: "Orange Côte d'Ivoire", val: "3 673 M FCFA", prob: 30, com: "User_test", age: "2 612 jours", risk: true },
    { name: "Plan de formation", client: "ADVANS CI", val: "2 500 M FCFA", prob: 10, com: "Administrateur", age: "99 jours" },
  ],
  Montage: [
    { name: "Plan de PRA/PCA", client: "SANLAM ALLIANZ CI", val: "800 M FCFA", prob: 10, com: "Guy-Martial DATCHA", age: "99 jours" },
    { name: "Refonte infra système et virtualisation", client: "ARTCI", val: "500 M FCFA", prob: 50, com: "Segui Mireille KOUADIO", age: "99 jours" },
  ],
  Transmise: [
    { name: "Data center", client: "ARTCI", val: "1 974 M FCFA", prob: 50, com: "Segui Mireille KOUADIO", age: "99 jours" },
  ],
  Proposition: [
    { name: "AO : fourniture de services", client: "Banque Africaine de Développement (BAD)", val: "2 040 M FCFA", prob: 70, com: "Koffi Paulin APEDO", age: "2 700 jours", risk: true },
    { name: "Data center", client: "ORANGE BF", val: "1 800 M FCFA", prob: 70, com: "Romuald HIEN", age: "2 507 jours", risk: true },
  ],
  Négociation: [
    { name: "Renouvellement infra serveur messagerie Exchange", client: "ORANGE CI", val: "438 M FCFA", prob: 70, com: "Aristide D. CAUPHY", age: "99 jours" },
    { name: "Projet DRP", client: "SANLAM ALLIANZ CI", val: "326 M FCFA", prob: 90, com: "Jacques Marie DRIGBE", age: "13 jours" },
  ],
  Contractualisation: [
    { name: "Renew VEEAM", client: "MUGEFCI", val: "37 M FCFA", prob: 90, com: "Guy-Martial DATCHA", age: "99 jours" },
    { name: "Contrat SDWAN Huawei Mali", client: "ABI", val: "16 M FCFA", prob: 95, com: "Segui Mireille KOUADIO", age: "99 jours" },
  ],
};
