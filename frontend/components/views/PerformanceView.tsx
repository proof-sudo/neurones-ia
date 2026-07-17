import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGaugeRow } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { HBarChart } from "@/components/charts/AnalyticsCharts";
import { LOST_BY_COMMERCIAL, LOST_DEALS } from "@/lib/fixtures/forecast";

const RECOS = [
  { tag: "donnée manquante", html: 'Le CRM ne trace aucune <b>cause de perte</b> (pas de champ "lost_reason" alimenté). Recommandation : activer et rendre obligatoire ce champ dans Odoo pour permettre une vraie analyse des causes à l\'avenir.' },
  { tag: "qualité des noms", html: 'Le champ commercial contient des variantes de casse pour la même personne (ex : "Segui Mireille KOUADIO" vs "SEGUI MIREILLE KOUADIO"), ce qui fausse les statistiques par commercial. Recommandation : normaliser ce champ avant toute analyse de performance individuelle.' },
  { tag: "cycle de vente", html: "Le cycle de vente des dossiers perdus n'est pas calculable de façon fiable : la date de clôture (write_date) correspond souvent à une date de synchronisation en masse plutôt qu'à la vraie date de perte." },
  { tag: "écart valeur vs volume", html: "Le taux de victoire en valeur (24,3 %) est bien plus faible qu'en nombre (65,4 %) — les dossiers perdus sont structurellement plus gros que les dossiers gagnés, à investiguer en priorité sur les très gros comptes (BNI, MTN CI, BAD)." },
];

const TOP_CARDS = [
  { title: "🏆 Meilleur pays", text: "Côte d'Ivoire concentre la majorité du CA commandé 2025-2026 (211 clients sur 389 avec pays renseigné) et les plus gros comptes (Orange, MTN, Société Générale, BICICI)." },
  { title: "⚠️ Meilleure offre — non déterminable", text: "Aucune donnée produit/catégorie de service n'est disponible dans les tables actuelles (sale_orders.order_lines n'est pas structuré) — impossible d'identifier une « meilleure offre » de façon fiable." },
  { title: "🏆 Meilleur commercial (CA)", text: "Aristide D. CAUPHY — 1 665 M FCFA de CA commandé 2025-2026, le plus élevé du portefeuille nommé individuellement." },
];

export function PerformanceView() {
  const totalPerdu = LOST_DEALS.reduce((s, d) => s + d.montant, 0);

  return (
    <>
      <ViewHeader
        eyebrow="● intelligence commerciale"
        title="Performances"
        sub="Pays, commerciaux — pas de suivi produit ni de cause de perte dans les données actuelles"
      >
        <AiChip>données réelles Odoo</AiChip>
      </ViewHeader>

      <KpiGaugeRow
        items={[
          { color: "var(--color-good)", label: "Taux de victoire (nombre)", value: "65,4%", delta: "2 677 gagnées / 4 091 clôturées (historique)", deltaVariant: "up" },
          { color: "var(--color-bad)", label: "Taux de victoire (valeur, 2026)", value: "24,3%", delta: "les dossiers perdus sont en moyenne plus gros", deltaVariant: "down" },
          { color: "var(--color-ai)", label: "Cycle de vente moyen (gagné)", value: "79 j", delta: "non fiable pour les dossiers perdus (voir constat IA)", deltaVariant: "flag" },
          { color: "var(--color-warn)", label: "Top 6 pertes documentées", value: `${totalPerdu.toLocaleString("fr-FR")} M FCFA`, delta: `${LOST_DEALS.length} dossiers, dédupliqués`, deltaVariant: "down" },
        ]}
      />

      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {TOP_CARDS.map((c) => (
          <div key={c.title} className="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-[18px]">
            <h3 className="text-[13.5px]">{c.title}</h3>
            <p className="text-[11.5px] leading-relaxed text-muted">{c.text}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHead title="Opportunités perdues par commercial">
            <AiChip>substitut réel — pas de champ &quot;cause&quot; dans le CRM</AiChip>
          </PanelHead>
          <HBarChart
            labels={LOST_BY_COMMERCIAL.map((c) => c.name)}
            values={LOST_BY_COMMERCIAL.map((c) => c.n)}
            label="Opportunités perdues (nb)"
          />
        </Panel>
        <Panel>
          <PanelHead title="Constats IA" />
          <div className="flex flex-col gap-2.5">
            {RECOS.map((r, i) => (
              <div key={i} className="rounded-lg border border-l-2 border-line border-l-ai bg-panel px-3 py-[11px] text-xs leading-relaxed">
                <span className="mb-1 block font-mono text-[10px] tracking-[0.06em] text-ai">◆ {r.tag}</span>
                <span dangerouslySetInnerHTML={{ __html: r.html }} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="rounded-card border border-line bg-panel p-5">
        <PanelHead title="Détail des plus grosses affaires perdues (réel, dédupliqué)" />
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Opportunité", "Client", "Montant", "Commercial"].map((h) => (
                <th key={h} className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LOST_DEALS.map((d, i) => (
              <tr key={i} className="border-b border-line last:border-none">
                <td className="px-2 py-2.5 text-text">{d.name}</td>
                <td className="px-2 py-2.5">{d.client}</td>
                <td className="px-2 py-2.5 font-mono">{d.montant} M FCFA</td>
                <td className="px-2 py-2.5">{d.commercial}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
