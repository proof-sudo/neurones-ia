"use client";

import { useState } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGaugeRow } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { DetailPanel, DetailGrid, DetailItem } from "@/components/ui/DetailPanel";
import {
  ForecastLineChart,
  StageDoughnut,
} from "@/components/charts/AnalyticsCharts";
import {
  FORECAST_MONTHS,
  FORECAST_OPPS,
  buildForecastParClient,
  type ForecastClient,
} from "@/lib/fixtures/forecast";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR") + " M FCFA";

const SCENARIO_TOOLTIP = [
  "Pessimiste = ne retient que les opportunités à 50 % de probabilité ou plus, à leur valeur pondérée.",
  "Réaliste = somme des valeurs d'opportunités pondérées par leur probabilité de signature (valeur × probabilité).",
  "Optimiste = forecast réaliste, additionné de la moitié de la valeur des opportunités moins avancées (probabilité < 50 %).",
  "Prochaine échéance = déduite de l'étape la plus avancée du client dans le pipeline (une négociation aboutit généralement sous 1 mois, une prospection sous 5 mois).",
].join("\n");

// Impayés connus, pesant dans la décision par client (données réelles de trésorerie).
const IMPAYES_CONNUS: Record<string, string> = {
  "Banque Africaine de Développement (BAD)": "1 682 M FCFA d’impayés (444 jours)",
  "Orange Côte d’Ivoire": "314 M FCFA d’impayés (569 jours)",
  "Orange Côte d'Ivoire": "314 M FCFA d’impayés (569 jours)",
  "Orange Liberia": "273 M FCFA d’impayés (833 jours)",
};

/** Décision par règles sur données réelles (repli local, comme le mockup sans clé API). */
function decisionClient(c: ForecastClient): { decision: React.ReactNode; action: string } {
  const impaye = IMPAYES_CONNUS[c.client];
  const oppRisque = c.opps.find((o) => o.risk);
  if (impaye && oppRisque) {
    return {
      decision: (
        <>
          <b>Conditionner et requalifier.</b> Ce client cumule {impaye} et une opportunité obsolète (
          {oppRisque.name}) — conditionner tout nouvel engagement au recouvrement, et requalifier
          l&apos;opportunité à risque.
        </>
      ),
      action:
        "Organiser cette semaine un point recouvrement + revue d'opportunité avec le commercial en charge.",
    };
  }
  if (impaye) {
    return {
      decision: (
        <>
          <b>Conditionner.</b> {fmt(c.pondere)} de forecast pondéré, mais {impaye} — sécuriser le
          recouvrement avant d&apos;investir davantage commercialement.
        </>
      ),
      action: "Lancer la relance de recouvrement avant toute nouvelle proposition.",
    };
  }
  if (oppRisque) {
    return {
      decision: (
        <>
          <b>Requalifier.</b> {oppRisque.name} est signalée à risque/obsolète — sa probabilité
          déclarée gonfle artificiellement le forecast de ce client.
        </>
      ),
      action:
        "Contacter le client cette semaine pour confirmer si le besoin existe encore ; sinon, clôturer l'opportunité.",
    };
  }
  return {
    decision: (
      <>
        <b>Sécuriser.</b> {fmt(c.pondere)} pondérés sans signal de risque ni impayé connu —
        c&apos;est un forecast à défendre activement.
      </>
    ),
    action:
      "Fixer la prochaine étape avec le client (rendez-vous ou envoi de proposition) sous 7 jours pour maintenir le rythme du cycle de vente (79 jours en moyenne).",
  };
}

export function ForecastView() {
  const [analysis, setAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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

  const clients = buildForecastParClient();
  const sortedOpps = [...opps].sort((a, b) => b.val * b.prob - a.val * a.prob);
  const topOpp = sortedOpps[0];
  const topShare = Math.round(((topOpp.val * topOpp.prob) / 100 / realiste) * 100);
  const topStage = stageEntries[0];
  const topStageShare = Math.round((topStage[1] / realiste) * 100);

  const selectedClient = clients.find((c) => c.client === selected) ?? null;
  const selectedDecision = selectedClient ? decisionClient(selectedClient) : null;

  function genererAnalyse() {
    setAnalyzing(true);
    setAnalysis(false);
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
          <PanelHead
            title={
              <span className="inline-flex items-center gap-1.5">
                Projection à 6 mois — 3 scénarios
                <span className="cursor-help text-[13px] font-normal text-muted" title={SCENARIO_TOOLTIP}>
                  ⓘ
                </span>
              </span>
            }
          >
            <AiChip>pessimiste / réaliste / optimiste</AiChip>
          </PanelHead>
          <ForecastLineChart labels={FORECAST_MONTHS} optimiste={bOpti} realiste={bReal} pessimiste={bPess} />
        </Panel>
        <Panel>
          <PanelHead title="Répartition du forecast par étape" />
          <StageDoughnut labels={stageEntries.map((e) => e[0])} values={stageEntries.map((e) => Math.round(e[1]))} />
        </Panel>
      </div>

      <DetailPanel
        open={!!selectedClient}
        title={selectedClient ? `Décision — ${selectedClient.client}` : ""}
        onClose={() => setSelected(null)}
      >
        {selectedClient && selectedDecision && (
          <DetailGrid>
            <DetailItem k="Valeur totale">{fmt(selectedClient.total)}</DetailItem>
            <DetailItem k="Valeur pondérée" valueClassName="text-ai">
              {fmt(selectedClient.pondere)}
            </DetailItem>
            <DetailItem k="Dont à risque" valueClassName={selectedClient.risque > 0 ? "text-bad" : "text-good"}>
              {selectedClient.risque > 0 ? fmt(selectedClient.risque) : "aucune"}
            </DetailItem>
            <DetailItem k="Prochaine échéance">{FORECAST_MONTHS[Math.min(selectedClient.minOffset, 5)]}</DetailItem>
            <DetailItem k="Opportunités réelles de ce client" full valueClassName="text-[12.5px] font-medium leading-relaxed">
              <div className="flex flex-col gap-1">
                {selectedClient.opps.map((o, i) => (
                  <div key={i}>
                    {o.name} — {o.val} M FCFA ({o.prob}%, {o.stage}
                    {o.risk && <b className="text-bad"> · à risque</b>})
                  </div>
                ))}
              </div>
            </DetailItem>
            <DetailItem k="Décision recommandée (IA)" full valueClassName="text-[12.5px] font-medium leading-relaxed">
              <div>{selectedDecision.decision}</div>
              <div className="mt-1.5">
                <b>Première action :</b> {selectedDecision.action}
              </div>
              <div className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
                Généré en mode simplifié (règles sur données réelles) — la lecture rédigée
                dynamiquement se branche côté serveur.
              </div>
            </DetailItem>
          </DetailGrid>
        )}
      </DetailPanel>

      <Panel>
        <PanelHead title="Forecast par client">
          <AiChip>cliquez sur un client pour la décision IA</AiChip>
        </PanelHead>
        <div className="mb-3 text-[12px] text-muted">
          Chaque ligne agrège les vraies opportunités du pipeline pour ce client. Cliquez sur un
          client : le cadre de décision s&apos;ouvre au-dessus, entre la projection et ce tableau.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {["Client", "Opportunités", "Valeur totale", "Valeur pondérée", "Dont à risque", "Prochaine échéance"].map((h) => (
                  <th key={h} className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.client}
                  onClick={() => setSelected((cur) => (cur === c.client ? null : c.client))}
                  className={`cursor-pointer border-b border-line last:border-none transition-colors hover:bg-panel-2 ${
                    selected === c.client ? "bg-panel-2" : ""
                  }`}
                >
                  <td className="px-2 py-2.5 font-medium text-text">{c.client}</td>
                  <td className="px-2 py-2.5">{c.opps.length}</td>
                  <td className="px-2 py-2.5 font-mono">{fmt(c.total)}</td>
                  <td className="px-2 py-2.5 font-mono text-ai">{fmt(c.pondere)}</td>
                  <td className={`px-2 py-2.5 font-mono ${c.risque > 0 ? "text-bad" : "text-good"}`}>
                    {c.risque > 0 ? fmt(c.risque) : "aucune"}
                  </td>
                  <td className="px-2 py-2.5">{FORECAST_MONTHS[Math.min(c.minOffset, 5)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
