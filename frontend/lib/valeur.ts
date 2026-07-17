import { CLIENT_PROFILES } from "./fixtures/clients";

// Date de référence de l'outil (port du mockup — pas Date.now() pour rester déterministe)
const AUJOURDHUI = new Date(2026, 6, 17); // 17 juillet 2026

const MOIS_FR: Record<string, number> = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

const RENOUVELLEMENT_KEYWORDS = ["licence", "renouvellement", "abonnement", "maintenance", "subscription"];
const CROSSSELL_KEYWORDS = ["sécurité", "securite", "groupé", "groupe", "cybersécurité", "cybersecurite", "audit"];
const UPSELL_KEYWORDS = ["panier", "potentiel", "structurer", "stratégique", "strategique", "développer", "developper"];

function parseDateFr(str: string): Date | null {
  if (!str) return null;
  const m = str.toLowerCase().match(/([a-zéû]+)\s+(\d{4})/);
  if (!m || !(m[1] in MOIS_FR)) return null;
  return new Date(parseInt(m[2], 10), MOIS_FR[m[1]], 1);
}

function moisEcoules(d: Date | null): number | null {
  if (!d) return null;
  return (AUJOURDHUI.getFullYear() - d.getFullYear()) * 12 + (AUJOURDHUI.getMonth() - d.getMonth());
}

export interface ValeurOpportunity {
  client: string;
  titre: string;
  detail: string;
  montant?: string;
}

export type ValeurCategory = "crosssell" | "upsell" | "obsolete" | "renouvellement";

export const VALEUR_CATEGORY_LABEL: Record<ValeurCategory, string> = {
  crosssell: "Cross-sell",
  upsell: "Up-sell",
  obsolete: "Obsolète",
  renouvellement: "Renouvellement",
};

/** Port de `classifierMonteeValeur()` — classement par règles réelles (dates + mots-clés), pas par IA. */
export function classifierMonteeValeur(): Record<ValeurCategory, ValeurOpportunity[]> {
  const renouvellement: ValeurOpportunity[] = [];
  const obsolete: ValeurOpportunity[] = [];
  const crosssell: ValeurOpportunity[] = [];
  const upsell: ValeurOpportunity[] = [];

  CLIENT_PROFILES.forEach((c) => {
    (c.historique || []).forEach((h) => {
      const d = parseDateFr(h.periode);
      const age = moisEcoules(d);
      const titreLower = h.titre.toLowerCase();
      const estRecurrent = RENOUVELLEMENT_KEYWORDS.some((k) => titreLower.includes(k));
      if (age === null) return;
      if (estRecurrent && age >= 6 && age <= 20) {
        renouvellement.push({
          client: c.name,
          titre: h.titre,
          detail: `Souscrit en ${h.periode} — échéance probable dans les prochains mois (cycle annuel).`,
        });
      } else if (age > 24) {
        obsolete.push({
          client: c.name,
          titre: h.titre,
          detail: `Souscrit en ${h.periode}, soit ${age} mois — probablement en fin de cycle technologique, à réévaluer.`,
        });
      }
    });

    (c.recommandations || []).forEach((r) => {
      const rLower = (r.service + " " + r.rationale).toLowerCase();
      if (CROSSSELL_KEYWORDS.some((k) => rLower.includes(k))) {
        crosssell.push({ client: c.name, titre: r.service, detail: r.rationale });
      } else if (UPSELL_KEYWORDS.some((k) => rLower.includes(k))) {
        upsell.push({ client: c.name, titre: r.service, detail: r.rationale });
      }
    });
  });

  return {
    crosssell: crosssell.slice(0, 5),
    upsell: upsell.slice(0, 5),
    obsolete: obsolete.slice(0, 5),
    renouvellement: renouvellement.slice(0, 5),
  };
}
