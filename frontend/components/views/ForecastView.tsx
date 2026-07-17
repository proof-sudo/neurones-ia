"use client";

import { useState } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGaugeRow } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import {
  ForecastLineChart,
  StageDoughnut,
  VBarChart,
} from "@/components/charts/AnalyticsCharts";
import { FORECAST_MONTHS, FORECAST_OPPS } from "@/lib/fixtures/forecast";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR") + " M FCFA";

export function ForecastView() {
  const [analysis, setAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const opps = FORECAST_OPPS;
  const wSum = (arr: typeof opps) => arr.reduce((s, o) => s + (o.val * o.prob) / 100, 0);
  const realiste = wSum(opps);
  const pessimiste = opps.filter((o) => o.prob >= 50).reduce((s, o) => s + (o.val * o.prob) / 100, 0);
  const optimiste = realiste + opps.filter((o) => o.prob < 50).reduce((s, o) => s + o.val * 0.5, 0);
  const totalPipeline = opps.reduce((s, o) => s + o.val, 0);
  const avgProb = Math.round(opps.reduce((s, o) => s + o.prob, 0) / opps.length);

  // Buckets mensuels
  const bReal = new Array(6).fill(0);
  const bPess = new Array(6).fill(0);
  const bOpti = new Array(6).fill(0);
  opps.forEach((o) => {
    const idx = Math.min(o.offset, 5);
    const wv = (o.val * o.prob) / 100;
    bReal[idx] += wv;
    bPess[idx] += o.prob >= 50 ? wv : 0;
    bOpti[idx] += o.prob < 50 ? o.val * 0.5 : wv;
  });

  // Répartition par étape
  const stageTotals: Record<string, number> = {};
  opps.forEach((o) => (stageTotals[o.stage] = (stageTotals[o.stage] || 0) + (o.val * o.prob) / 100));
  const stageEntries = Object.entries(stageTotals).sort((a, b) => b[1] - a[1]);

  // Répartition par commercial
  const comTotals: Record<string, number> = {};
  opps.forEach((o) => (comTotals[o.com] = (comTotals[o.com] || 0) + (o.val * o.prob) / 100));
  const comEntries = Object.entries(comTotals).sort((a, b) => b[1] - a[1]);

  const sortedOpps = [...opps].sort((a, b) => b.val * b.prob - a.val * a.prob);

  const topOpp = sortedOpps[0];
  const topShare = Math.round(((topOpp.val * topOpp.prob) / 100 / realiste) * 100);
  const topStage = stageEntries[0];
  const topStageShare = Math.round((topStage[1] / realiste) * 100);

  function genererAnalyse() {
    setAnalyzing(true);
    setAnalysis(false);
    // Repli local sur les données déjà chargées (mêmes chiffres que les KPI et
    // le graphique ci-dessous) ; le vrai LLM se branchera côté serveur.
    setTimeout(() => {
      setAnalysis(true);
      setAnalyzing(false);
    }, 700);
  }

  return (
    <>
      <ViewHeader
        eyebrow="● prévision des ventes"
        title="Forecast"
        sub="Estimation du CA futur à partir du pipeline pondéré, de l'historique et des tendances"
      >
        <button
          onClick={genererAnalyse}
          disabled={analyzing}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          🔮 Analyse IA du forecast
        </button>
      </ViewHeader>

      <Panel className="mb-4 border-l-[3px] border-l-ai">
        <PanelHead title="Ce que l'IA voit dans ce forecast">
          <AiChip>analyse</AiChip>
        </PanelHead>
        {analyzing ? (
          <AiChip>analyse en cours…</AiChip>
        ) : !analysis ? (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Analyse IA du forecast » pour une lecture qualitative des
            opportunités qui composent ce chiffre — pas juste le total.
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-text">
            <p>
              Le scénario réaliste ({fmt(realiste)}) est concentré : la seule opportunité
              « {topOpp.name} » ({topOpp.client}) pèse pour {topShare}% du total pondéré.
              Une seule signature ou un seul retard sur ce dossier suffit à faire bouger le
              forecast global.
            </p>
            <p>
              L&apos;étape « {topStage[0]} » concentre à elle seule {topStageShare}% du
              forecast pondéré ({fmt(topStage[1])}) — une concentration à surveiller si ces
              dossiers glissent tous au même moment.
            </p>
            <p>
              Écart entre les scénarios : {fmt(optimiste - pessimiste)} séparent le
              pessimiste et l&apos;optimiste, ce qui reflète la probabilité moyenne encore
              incertaine ({avgProb}%) sur l&apos;échantillon de {opps.length} opportunités
              réelles du pipeline.
            </p>
          </div>
        )}
      </Panel>

      <KpiGaugeRow
        items={[
          { color: "var(--color-good)", label: "Forecast réaliste (6 mois)", value: fmt(realiste), delta: `confiance moyenne ${avgProb}%`, deltaVariant: "up" },
          { color: "var(--color-bad)", label: "Scénario pessimiste", value: fmt(pessimiste), delta: "opportunités ≥ 50 % uniquement", deltaVariant: "down" },
          { color: "var(--color-ai)", label: "Scénario optimiste", value: fmt(optimiste), delta: "inclut la moitié des deals amont", deltaVariant: "flag" },
          { color: "var(--color-ai)", label: "Pipeline total couvert", value: fmt(totalPipeline), delta: `${opps.length} opportunités (échantillon réel)` },
        ]}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHead title="Projection à 6 mois — 3 scénarios">
            <AiChip>pessimiste / réaliste / optimiste</AiChip>
          </PanelHead>
          <ForecastLineChart labels={FORECAST_MONTHS} optimiste={bOpti} realiste={bReal} pessimiste={bPess} />
        </Panel>
        <Panel>
          <PanelHead title="Répartition du forecast par étape" />
          <StageDoughnut labels={stageEntries.map((e) => e[0])} values={stageEntries.map((e) => Math.round(e[1]))} />
        </Panel>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHead title="Contribution par commercial" />
          <VBarChart
            labels={comEntries.map((e) => e[0])}
            values={comEntries.map((e) => Math.round(e[1]))}
            label="Forecast pondéré (M FCFA)"
          />
        </Panel>
        <Panel>
          <PanelHead title="Méthodologie IA" />
          <div className="flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-text">
            <p>
              <b>Réaliste</b> = somme des valeurs d&apos;opportunités pondérées par leur
              probabilité de signature (valeur × probabilité).
            </p>
            <p>
              <b>Pessimiste</b> = ne retient que les opportunités à 50 % de probabilité ou
              plus, à leur valeur pondérée.
            </p>
            <p>
              <b>Optimiste</b> = forecast réaliste, additionné de la moitié de la valeur
              des opportunités moins avancées (probabilité &lt; 50 %).
            </p>
            <p>
              <b>Clôture estimée</b> déduite de l&apos;étape actuelle du pipeline (une
              négociation aboutit généralement sous 1 mois, une opportunité en prospection
              sous 5 mois).
            </p>
          </div>
        </Panel>
      </div>

      <div className="rounded-card border border-line bg-panel p-5">
        <PanelHead title="Contribution par opportunité" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {["Opportunité", "Client", "Étape", "Valeur", "Probabilité", "Valeur pondérée", "Clôture estimée"].map((h) => (
                  <th key={h} className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOpps.map((o, i) => (
                <tr key={i} className="border-b border-line last:border-none">
                  <td className="px-2 py-2.5 text-text">{o.name}</td>
                  <td className="px-2 py-2.5">{o.client}</td>
                  <td className="px-2 py-2.5"><Badge variant="warm">{o.stage}</Badge></td>
                  <td className="px-2 py-2.5 font-mono">{o.val} M FCFA</td>
                  <td className="px-2 py-2.5 font-mono">{o.prob}%</td>
                  <td className="px-2 py-2.5 font-mono text-ai">{Math.round((o.val * o.prob) / 100)} M FCFA</td>
                  <td className="px-2 py-2.5">{FORECAST_MONTHS[Math.min(o.offset, 5)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
