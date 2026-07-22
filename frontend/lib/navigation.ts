import type { NavGroup, NavModule, ModuleAccess, Role } from "./types";

/**
 * Liste des modules (= vues = routes). L'ordre, les libellés et les icônes
 * reprennent exactement la sidebar du mockup dashboard_commercial_17.html.
 * Chaque `view` correspond à un dossier route dans app/(cockpit)/<view>/.
 */
export const NAV_MODULES: NavModule[] = [
  { view: "dashboard", icon: "◧", label: "Tableau de bord" },
  // { view: "forecast", icon: "⟁", label: "Forecast" },
  { view: "tresorerie", icon: "◒", label: "Trésorerie & marges" },
  { view: "performance", icon: "◭", label: "Performances" },
  { view: "presales", icon: "❖", label: "Appel d'offre" },
  { view: "veille", icon: "◔", label: "Veille" },
  { view: "crosssell", icon: "✚", label: "Montée en valeur" },
  { view: "clients", icon: "◈", label: "Clients" },
  { view: "partenaires", icon: "◈", label: "Fournisseurs" },
  // { view: "pipeline", icon: "▥", label: "Pipeline" },
  { view: "admin", icon: "⚙", label: "Administration" },
];

/** Regroupement des modules dans la sidebar (mêmes libellés que le mockup) */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage & Projection",
    views: ["dashboard", "tresorerie", "performance"],
  },
  {
    label: "Exécution commerciale",
    views: ["presales", "veille", "crosssell"],
  },
  {
    label: "Référentiel",
    views: ["clients", "partenaires"],
  },
  {
    label: "Configuration",
    views: ["admin"],
  },
];

/**
 * Matrice des droits PAR DÉFAUT (module × rôle) — port exact de la matrice
 * `moduleAccess` du mockup. La matrice EFFECTIVE est dynamique : le backend
 * (config/permissions.py + table module_permissions, éditable depuis l'écran
 * Administration) la renvoie via `allowed_views` de /v1/auth/me. Celle-ci ne
 * sert que de repli quand le backend est injoignable. L'admin a toujours
 * accès à tout (traité à part, jamais false ici).
 */
export const MODULE_ACCESS: ModuleAccess = {
  briefing:     { admin: true, dg: true,  dir_commercial: true,  dir_operations: true,  presale: false, dir_financier: true,  commercial: true },
  dashboard:    { admin: true, dg: true,  dir_commercial: true,  dir_operations: true,  presale: false, dir_financier: true,  commercial: true },
  forecast:     { admin: true, dg: true,  dir_commercial: true,  dir_operations: true,  presale: false, dir_financier: false, commercial: false },
  tresorerie:   { admin: true, dg: true,  dir_commercial: false, dir_operations: false, presale: false, dir_financier: true,  commercial: false },
  performance:  { admin: true, dg: true,  dir_commercial: true,  dir_operations: true,  presale: false, dir_financier: true,  commercial: false },
  veille:       { admin: true, dg: true,  dir_commercial: true,  dir_operations: false, presale: true,  dir_financier: false, commercial: true },
  crosssell:    { admin: true, dg: false, dir_commercial: true,  dir_operations: false, presale: false, dir_financier: false, commercial: true },
  clients:      { admin: true, dg: true,  dir_commercial: true,  dir_operations: true,  presale: false, dir_financier: true,  commercial: true },
  partenaires:  { admin: true, dg: false, dir_commercial: true,  dir_operations: true,  presale: false, dir_financier: false, commercial: false },
  pipeline:     { admin: true, dg: true,  dir_commercial: true,  dir_operations: true,  presale: true,  dir_financier: false, commercial: true },
  presales:     { admin: true, dg: true,  dir_commercial: false, dir_operations: true,  presale: true,  dir_financier: false, commercial: false },
  admin:        { admin: true, dg: false, dir_commercial: false, dir_operations: false, presale: false, dir_financier: false, commercial: false },
};

/**
 * Vues autorisées pour un rôle. `admin` = null (accès total).
 * Utilisé côté serveur (layout, gating de route) ET pour filtrer la sidebar.
 */
export function getAllowedViews(role: Role): Set<string> | null {
  if (role === "admin") return null; // accès total
  const allowed = new Set<string>();
  for (const [view, access] of Object.entries(MODULE_ACCESS)) {
    if (access[role]) allowed.add(view);
  }
  return allowed;
}

/** Première vue autorisée pour un rôle (fallback de redirection). */
export function firstAllowedView(role: Role): string {
  const allowed = getAllowedViews(role);
  if (allowed === null) return "dashboard";
  if (allowed.has("dashboard")) return "dashboard";
  return [...allowed][0] ?? "dashboard";
}

export function canAccess(role: Role, view: string): boolean {
  const allowed = getAllowedViews(role);
  return allowed === null || allowed.has(view);
}

/**
 * Première vue autorisée dans l'ordre de la sidebar, à partir de la liste
 * dynamique `allowed_views` du backend. `null` = accès total (admin).
 */
export function firstAllowedFrom(views: string[] | null): string {
  if (views === null || views.includes("dashboard")) return "dashboard";
  const first = NAV_MODULES.find((m) => views.includes(m.view));
  return first?.view ?? views[0] ?? "dashboard";
}
