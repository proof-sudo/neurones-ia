
// Types partagés du cockpit commercial (port du mockup HTML)

export type Role =
  | "admin"
  | "dg"
  | "dir_commercial"
  | "dir_operations"
  | "presale"
  | "dir_financier"
  | "commercial";

export interface Profile {
  role: Role;
  nom: string;
  email: string;
  icon: string;
  initiales: string;
  focus: string;
  /** Accroche IA optionnelle affichée sur la carte de profil */
  ai?: string;
}

/** Un module = une vue = une route de la sidebar */
export interface NavModule {
  view: string;
  icon: string;
  label: string;
}

/** Regroupement visuel des modules dans la sidebar */
export interface NavGroup {
  label: string;
  views: string[];
}

/** Matrice module → (rôle → autorisé) */
export type ModuleAccess = Record<string, Record<Role, boolean>>;

// ---------- Dashboard ----------

export type PeriodKey = "mois" | "trimestre" | "annee";

export interface PeriodData {
  caLabel: string;
  ca: string;
  caDelta: string;
  objectif: string;
  objectifDelta: string;
  marge: string;
  margeDelta: string;
  pipeline: string;
  pipelineDelta: string;
  transfo: string;
  transfoDelta: string;
  months: string[];
  realise: (number | null)[];
  prevision: (number | null)[];
}

export interface KpiDetail {
  title: string;
  items: [string, string][];
}

export interface TopClient {
  name: string;
  ca: number;
  pct: number;
  secteur: string;
}

export interface PipelineStage {
  name: string;
  n: number;
  val: string;
}

// ---------- Leads ----------

export type Qualification = "hot" | "warm" | "cold";

export interface Lead {
  ent: string;
  ville: string;
  tel: string;
  /** Valeur estimée en M FCFA (0 = à chiffrer) */
  val: number;
  qual: Qualification;
  com: string;
  notes: string;
}

// ---------- Clients 360 ----------

export interface ClientHistoryItem {
  titre: string;
  periode: string;
  statut: string;
}

export interface ClientReco {
  service: string;
  rationale: string;
}

export interface ClientProfile {
  name: string;
  since: string;
  ca: string;
  dossiers: string;
  resteEncaisser: string;
  backlog: string;
  contact: string;
  dernierProjet: string;
  secteur: string;
  activite: string;
  historique: ClientHistoryItem[];
  recommandations: ClientReco[];
}

// ---------- Pipeline (kanban) ----------

export interface KanbanCard {
  name: string;
  client: string;
  val: string;
  prob: number;
  com: string;
  age: string;
  risk?: boolean;
}

export type KanbanData = Record<string, KanbanCard[]>;

// ---------- Partenaires ----------

export interface PartnerOrder {
  ref: string;
  montant: number;
  date: string;
}

export interface Partner {
  name: string;
  type: string;
  specialite: string;
  since: string;
  dealsApportes: number;
  caGenere: number;
  contact: string;
  statut: string;
  /** Date de la dernière commande (bon de commande réel) — sert au statut « Dormant » et à l'activité. */
  derniereCommande: string;
  /** Historique réel des commandes (purchase_orders). */
  commandes: PartnerOrder[];
}

// ---------- Veille AO ----------

export interface VeilleAO {
  id: string;
  name: string;
  organisme: string;
  secteur: string;
  source: string;
  montant: string;
  deadline: string;
  match: number;
  reason: string;
  isNew?: boolean;
}

// ---------- Veille stratégique ----------

export interface VeilleSource {
  name: string;
  url: string;
  zone: string;
  keywords: string;
  lastScan: string;
}

export interface DiscardedSignal {
  titre: string;
  motif: string;
}

export interface VeilleReco {
  titre: string;
  texte: string;
  effort: string;
}

// ---------- Veille Client (prospects suggérés) ----------

export interface ProspectSuggestion {
  nom: string;
  secteur: string;
  raison: string;
  projet: string;
}
