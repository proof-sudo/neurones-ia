"use client";

import { useState, useTransition } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGaugeRow } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { HBarChart } from "@/components/charts/AnalyticsCharts";
import { fmtM } from "@/lib/format";
import { generatePerformanceAnalysisAction } from "@/app/actions";
import type { PerformanceSummary } from "@/lib/api/performance";

export function PerformanceLive({ data }: { data: PerformanceSummary }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, startAnalyzing] = useTransition();

  const { win_rate: winRate, lost_deals: lostDeals } = data;

  function genererAnalyse() {
    setAnalysisError(null);
    startAnalyzing(async () => {
      const res = await generatePerformanceAnalysisAction();
      if (res.ok) setAnalysis(res.analysis);
      else setAnalysisError(res.error);
    });
  }

  const topByClient = lostDeals.by_client.slice(0, 10);
  const topDeals = [...lostDeals.top_deals].sort((a, b) => b.montant_xof - a.montant_xof);

  return (
    <>
      <ViewHeader
        eyebrow="● intelligence commerciale"
        title="Performances"
        sub="Taux de victoire et opportunités perdues, calculés sur l'historique réel du pipeline"
      >
        <button
          onClick={genererAnalyse}
          disabled={analyzing}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          📊 Analyse IA des performances
        </button>
      </ViewHeader>

      <Panel className="mb-4 border-l-[3px] border-l-ai">
        <PanelHead title="Ce que l'IA voit dans les performances">
          <AiChip>analyse</AiChip>
        </PanelHead>
        {analyzing ? (
          <AiChip>analyse en cours…</AiChip>
        ) : analysisError ? (
          <div className="text-[12.5px] text-bad">Analyse indisponible : {analysisError}</div>
        ) : !analysis ? (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Analyse IA des performances » pour une lecture qualitative rédigée par
            Claude à partir du taux de victoire et des pertes réelles.
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-text">
            {analysis.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </Panel>

      <KpiGaugeRow
        items={[
          { color: "var(--color-good)", label: "Taux de victoire (nombre)", value: `${winRate.taux_nb_pct}%`, delta: `${winRate.gagnees_nb} gagnées / ${winRate.gagnees_nb + winRate.perdues_nb} clôturées (historique)`, deltaVariant: "up" },
          { color: "var(--color-bad)", label: "Taux de victoire (valeur)", value: `${winRate.taux_valeur_pct}%`, delta: "les dossiers perdus pèsent-ils plus lourd ?", deltaVariant: winRate.taux_valeur_pct < winRate.taux_nb_pct ? "down" : "up" },
          { color: "var(--color-warn)", label: "Opportunités perdues", value: `${lostDeals.nb_total}`, delta: "historique complet (pipeline synchronisé)", deltaVariant: "flag" },
          { color: "var(--color-bad)", label: "Montant total perdu", value: fmtM(lostDeals.montant_total_xof), delta: `${lostDeals.top_deals.length} dossiers détaillés ci-dessous`, deltaVariant: "down" },
        ]}
      />

      {lostDeals.nb_total === 0 ? (
        <Panel>
          <div className="text-[12.5px] text-muted">Aucune opportunité perdue enregistrée dans le pipeline.</div>
        </Panel>
      ) : (
        <>
          <div className="mb-4">
            <Panel>
              <PanelHead title="Pertes par client">
                <AiChip>où l&apos;entreprise perd le plus, en valeur réelle</AiChip>
              </PanelHead>
              <HBarChart
                labels={topByClient.map((c) => c.client)}
                values={topByClient.map((c) => Math.round(c.montant_xof / 1_000_000))}
                label="Opportunités perdues (M FCFA)"
              />
            </Panel>
          </div>

          <div className="rounded-card border border-line bg-panel p-5">
            <PanelHead title="Détail des plus grosses affaires perdues (réel)" />
            <div className="overflow-x-auto">
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
                  {topDeals.map((d, i) => (
                    <tr key={i} className="border-b border-line last:border-none">
                      <td className="px-2 py-2.5 text-text">{d.name}</td>
                      <td className="px-2 py-2.5">{d.client}</td>
                      <td className="px-2 py-2.5 font-mono text-bad">{fmtM(d.montant_xof)}</td>
                      <td className="px-2 py-2.5 text-muted">{d.commercial || "non renseigné"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
