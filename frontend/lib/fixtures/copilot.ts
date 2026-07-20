import type { Role } from "../types";

/**
 * Réponses pré-calculées de Sales IA (port du resolveAnswer du mockup v17,
 * figé sur les mêmes données réelles). Servies par la route API — aucune clé
 * API ne transite jamais côté client. Le vrai LLM (Anthropic / adapters
 * backend) se branchera dans la même route.
 */
export const PRECOMPUTED_RESPONSES: Record<string, string> = {
  "quel est le ca commandé cette année ?":
    "Le CA commandé en 2026 (janvier-juillet) est de <b>4 313 M FCFA</b>, en baisse de 29,3 % par rapport à la même période en 2025 (6 098 M FCFA). La marge médiane réelle est de 92 %, mais très dispersée selon les dossiers.",
  "quelles sont les factures impayées prioritaires ?":
    "La <b>BAD</b> concentre le plus gros risque : 1 682 M FCFA d'impayés cumulés sur 3 factures, dont 756 M FCFA en souffrance depuis 444 jours. Orange Côte d'Ivoire (314 M FCFA, 569 jours) et Orange Liberia (273 M FCFA, 833 jours) suivent. Au total, 10,86 Md FCFA d'impayés échus sur 842 factures.",
  "quelles opportunités sont à risque ?":
    "L'opportunité la plus problématique est <b>« Refresh WAN — Orange Côte d'Ivoire »</b> (3 673 M FCFA), ouverte depuis plus de 7 ans sans clôture. Plus largement, 1 048 opportunités (34 % du pipeline) ont plus d'un an d'ancienneté et sont probablement obsolètes.",
  "quelles anomalies de qualité de données existent ?":
    "Plusieurs anomalies réelles ont été détectées : 34 % du pipeline (1 048 opportunités) a plus d'un an d'ancienneté, « Orange BF » et « Orange Burkina Faso » semblent être le même client dupliqué, les noms de commerciaux ont des variantes de casse incohérentes, et le CRM ne trace ni cause de perte ni concurrent sur les opportunités perdues.",
  "quelles sont mes priorités du jour ?":
    "Les 3 actions les plus prioritaires actuellement identifiées : <b>Escalader les impayés BAD</b> (high), <b>Purger l'opportunité Orange Côte d'Ivoire — Refresh WAN</b> (high), <b>Récupérer le CDC réel — AO CNPS</b> (high). Voir le module Suggestions d'actions pour la liste complète, ou le Briefing IA du jour pour une synthèse rédigée.",
  "qui est le meilleur commercial ?":
    "<b>Aristide D. CAUPHY</b> est le commercial avec le CA le plus élevé (1 665 M FCFA sur 2025-2026). Attention : le champ commercial contient des variantes de casse pour certaines personnes, ce qui peut fausser ce classement pour d'autres analyses.",
  "où en sont les appels d'offres ?":
    "5 appels d'offres réels sont suivis dans l'outil, dont <b>1 seul avec une échéance encore valide</b> (AO Automatisation — CNPS, 30/07/2026) ; les autres traînent dans le CRM avec une échéance déjà dépassée. Voir le module Appels d'offres, et Veille AO pour les nouvelles opportunités détectées.",
  "quel est le pipeline actuel ?":
    "Le pipeline réel compte <b>3 050 opportunités</b> pour un total d'environ <b>107 677 M FCFA</b>. Attention : 1 048 d'entre elles (34 %) ont plus d'un an d'ancienneté et sont probablement obsolètes. Voir le module Pipeline pour le détail par étape.",
  "que propose notre catalogue ?":
    "Le catalogue de services est construit à partir des vraies lignes de commande : infrastructure & réseau, sécurité, licences, intégration et services managés. Voir le module Cross-sell pour les catégories détaillées et les opportunités de montée en valeur détectées par client.",
  "quelle est la marge actuelle ?":
    "La marge réelle observée (table dossiers) a une <b>médiane de 92 %</b>, mais avec une très grande dispersion : 1er quartile à 28,3 %, certains dossiers même négatifs (ex. -1,7 % chez MTN CI). Voir le module Coûts & marges pour le détail.",
  "quels sont mes leads ?":
    "Il y a actuellement <b>5 leads réels</b> (stade « New » du CRM) : 1 tiède et 4 froids. Le mieux qualifié est <b>KAYDAN</b> (498 M FCFA, probabilité 50 % déjà renseignée). Voir le module Leads pour le détail, ou Veille Client pour suggérer de nouveaux prospects potentiels.",
};

/** Questions suggérées adaptées à ce qui concerne chaque profil réellement (port du mockup). */
export const SUGGESTED_QUESTIONS_BY_ROLE: Record<Role, string[]> = {
  admin: [
    "Quel est le CA commandé cette année ?",
    "Quelles anomalies de qualité de données existent ?",
    "Quelles opportunités sont à risque ?",
  ],
  dg: [
    "Quel est le CA commandé cette année ?",
    "Quelles sont les factures impayées prioritaires ?",
    "Quelles sont mes priorités du jour ?",
  ],
  dir_commercial: [
    "Quel est le CA commandé cette année ?",
    "Quelles opportunités sont à risque ?",
    "Qui est le meilleur commercial ?",
  ],
  dir_operations: [
    "Où en sont les appels d'offres ?",
    "Quelles opportunités sont à risque ?",
    "Quel est le pipeline actuel ?",
  ],
  presale: [
    "Où en sont les appels d'offres ?",
    "Quelles sont mes priorités du jour ?",
    "Que propose notre catalogue ?",
  ],
  dir_financier: [
    "Quelles sont les factures impayées prioritaires ?",
    "Quelle est la marge actuelle ?",
    "Quel est le CA commandé cette année ?",
  ],
  commercial: [
    "Quels sont mes leads ?",
    "Quelles opportunités sont à risque ?",
    "Quelles sont mes priorités du jour ?",
  ],
};

export function getSuggestedQuestions(role: Role): string[] {
  return SUGGESTED_QUESTIONS_BY_ROLE[role] ?? SUGGESTED_QUESTIONS_BY_ROLE.commercial;
}

/** Libellé tronqué des chips de suggestion — même règle que le mockup. */
export function suggestionLabel(q: string): string {
  return q.length > 28 ? q.slice(0, 26) + "…" : q;
}

// Index normalisé (NFC + minuscules) pour un matching robuste quelle que soit
// la forme Unicode envoyée par le client.
const NORMALIZED_INDEX: Record<string, string> = Object.fromEntries(
  Object.entries(PRECOMPUTED_RESPONSES).map(([k, v]) => [
    k.normalize("NFC").toLowerCase(),
    v,
  ]),
);

export function resolvePrecomputed(question: string): string | null {
  const key = question.trim().normalize("NFC").toLowerCase();
  return NORMALIZED_INDEX[key] ?? null;
}
