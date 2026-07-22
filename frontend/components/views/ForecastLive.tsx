"use client";

import { useState, useTransition } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGaugeRow } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { DetailPanel, DetailGrid, DetailItem } from "@/components/ui/DetailPanel";
import { ForecastLineChart, StageDoughnut } from "@/components/charts/AnalyticsCharts";
import { fmtM } from "@/lib/format";
import {
  generateForecastAnalysisAction,
  generateClientDecisionAction,
  type ClientDecisionResult,
} from "@/app/actions";
import type { PipelineForecastData } from "@/lib/api/forecast";

const SCENARIO_TOOLTIP = [
  "Pessimiste = ne retient que les opportunités à 50 % de probabilité ou plus, à leur valeur pondérée.",
  "Réaliste = somme des valeurs d'opportunités pondérées par leur probabilité de signature (valeur × probabilité).",
  "Optimiste = forecast réaliste, additionné de la moitié de la valeur des opportunités moins avancées (probabilité < 50 %).",
  "Prochaine échéance = échéance réelle de l'opportunité (deadline Odoo), ou à défaut une estimation par étape.",
].join("\n");

const MFCFA_PER_XOF = 1 / 1_000_000;

function toM(values: number[]): number[] {
  return values.map((v) => Math.round(v * MFCFA_PER_XOF));
}

export function ForecastLive({ data }: { data: PipelineForecastData }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, startAnalyzing] = useTransition();

  const [selected, setSelected] = useState<string | null>(null);
  const [decision, setDecision] = useState<ClientDecisionResult | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionLoading, startDecision] = useTransition();
  const [clientPage, setClientPage] = useState(1);

  const {
    scenarios: scen,
    monthly_buckets: mb,
    by_stage: stageEntries,
    by_client: clients,
    month_labels: months,
    opportunities: opps,
  } = data;

  const selectedClient = clients.find((c) => c.client === selected) ?? null;

  const CLIENTS_PAGE_SIZE = 10;
  const clientTotalPages = Math.max(1, Math.ceil(clients.length / CLIENTS_PAGE_SIZE));
  const clientPageClamped = Math.min(clientPage, clientTotalPages);
  const pagedClients = clients.slice(
    (clientPageClamped - 1) * CLIENTS_PAGE_SIZE,
    clientPageClamped * CLIENTS_PAGE_SIZE,
  );

  function genererAnalyse() {
    setAnalysisError(null);
    startAnalyzing(async () => {
      const res = await generateForecastAnalysisAction();
      if (res.ok) setAnalysis(res.analysis);
      else setAnalysisError(res.error);
    });
  }

  function selectClient(client: string) {
    if (selected === client) {
      setSelected(null);
      setDecision(null);
      setDecisionError(null);
      return;
    }
    setSelected(client);
    setDecision(null);
    setDecisionError(null);
    startDecision(async () => {
      const res = await generateClientDecisionAction(client);
      if (res.ok) setDecision(res.decision);
      else setDecisionError(res.error);
    });
  }

  if (opps.length === 0) {
    return (
      <>
        <ViewHeader
          eyebrow="● prévision des ventes"
          title="Forecast"
          sub="Estimation du CA futur à partir du pipeline pondéré, de l'historique et des tendances"
        />
        <Panel>
          <div className="text-[12.5px] text-muted">
            Aucune opportunité ouverte dans le pipeline actuellement — pas de forecast à afficher.
          </div>
        </Panel>
      </>
    );
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
        ) : analysisError ? (
          <div className="text-[12.5px] text-bad">Analyse indisponible : {analysisError}</div>
        ) : !analysis ? (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Analyse IA du forecast » pour une lecture qualitative rédigée par Claude à
            partir des vraies opportunités du pipeline — pas juste le total.
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
          { color: "var(--color-good)", label: "Forecast réaliste (6 mois)", value: fmtM(scen.realiste_xof), delta: `confiance moyenne ${scen.avg_probability_pct}%`, deltaVariant: "up" },
          { color: "var(--color-bad)", label: "Scénario pessimiste", value: fmtM(scen.pessimiste_xof), delta: "opportunités ≥ 50 % uniquement", deltaVariant: "down" },
          { color: "var(--color-ai)", label: "Scénario optimiste", value: fmtM(scen.optimiste_xof), delta: "inclut la moitié des deals amont", deltaVariant: "flag" },
          { color: "var(--color-ai)", label: "Pipeline total couvert", value: fmtM(scen.total_pipeline_xof), delta: `${scen.nb_opportunites} opportunités (pipeline réel)` },
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
          <ForecastLineChart
            labels={months}
            optimiste={toM(mb.optimiste_xof)}
            realiste={toM(mb.realiste_xof)}
            pessimiste={toM(mb.pessimiste_xof)}
          />
        </Panel>
        <Panel>
          <PanelHead title="Répartition du forecast par étape" />
          <StageDoughnut
            labels={stageEntries.map((e) => e.stage)}
            values={toM(stageEntries.map((e) => e.weighted_xof))}
          />
        </Panel>
      </div>

      <DetailPanel
        open={!!selectedClient}
        title={selectedClient ? `Décision — ${selectedClient.client}` : ""}
        onClose={() => {
          setSelected(null);
          setDecision(null);
          setDecisionError(null);
        }}
      >
        {selectedClient && (
          <DetailGrid>
            <DetailItem k="Valeur totale">{fmtM(selectedClient.total_xof)}</DetailItem>
            <DetailItem k="Valeur pondérée" valueClassName="text-ai">
              {fmtM(selectedClient.weighted_xof)}
            </DetailItem>
            <DetailItem k="Dont à risque" valueClassName={selectedClient.at_risk_xof > 0 ? "text-bad" : "text-good"}>
              {selectedClient.at_risk_xof > 0 ? fmtM(selectedClient.at_risk_xof) : "aucune"}
            </DetailItem>
            <DetailItem k="Prochaine échéance">{months[Math.min(selectedClient.min_month_offset, 5)]}</DetailItem>
            <DetailItem k="Opportunités réelles de ce client" full valueClassName="text-[12.5px] font-medium leading-relaxed">
              <div className="flex flex-col gap-1">
                {selectedClient.opportunities.map((o, i) => (
                  <div key={i}>
                    {o.name} — {fmtM(o.value_xof)} ({o.probability_pct}%, {o.stage}
                    {o.at_risk && <b className="text-bad"> · échéance dépassée</b>})
                  </div>
                ))}
              </div>
            </DetailItem>
            <DetailItem k="Décision recommandée (IA)" full valueClassName="text-[12.5px] font-medium leading-relaxed">
              {decisionLoading ? (
                <AiChip>décision en cours…</AiChip>
              ) : decisionError ? (
                <div className="text-bad">Décision indisponible : {decisionError}</div>
              ) : decision ? (
                <>
                  <div>
                    <b>{decision.decision_label}.</b> {decision.justification}
                  </div>
                  <div className="mt-1.5">
                    <b>Première action :</b> {decision.action}
                  </div>
                  <div className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
                    {decision.ai_generated
                      ? "Justification rédigée par Claude"
                      : "Repli sur les règles (IA indisponible)"}{" "}
                    — décision bornée par des règles de risque déterministes (impayés réels + échéances Odoo),
                    jamais laissée au seul LLM.
                  </div>
                </>
              ) : null}
            </DetailItem>
          </DetailGrid>
        )}
      </DetailPanel>

      <Panel>
        <PanelHead title="Forecast par client">
          <AiChip>cliquez sur un client pour la décision IA</AiChip>
        </PanelHead>
        <div className="mb-3 text-[12px] text-muted">
          Chaque ligne agrège les vraies opportunités ouvertes du pipeline pour ce client. Cliquez sur un
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
              {pagedClients.map((c) => (
                <tr
                  key={c.client}
                  onClick={() => selectClient(c.client)}
                  className={`cursor-pointer border-b border-line last:border-none transition-colors hover:bg-panel-2 ${
                    selected === c.client ? "bg-panel-2" : ""
                  }`}
                >
                  <td className="px-2 py-2.5 font-medium text-text">{c.client}</td>
                  <td className="px-2 py-2.5">{c.nb_opportunites}</td>
                  <td className="px-2 py-2.5 font-mono">{fmtM(c.total_xof)}</td>
                  <td className="px-2 py-2.5 font-mono text-ai">{fmtM(c.weighted_xof)}</td>
                  <td className={`px-2 py-2.5 font-mono ${c.at_risk_xof > 0 ? "text-bad" : "text-good"}`}>
                    {c.at_risk_xof > 0 ? fmtM(c.at_risk_xof) : "aucune"}
                  </td>
                  <td className="px-2 py-2.5">{months[Math.min(c.min_month_offset, 5)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clientTotalPages > 1 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-[12px] text-muted">
            <span className="tabular-nums">
              {(clientPageClamped - 1) * CLIENTS_PAGE_SIZE + 1}–
              {Math.min(clientPageClamped * CLIENTS_PAGE_SIZE, clients.length)} sur {clients.length} clients
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setClientPage((p) => Math.max(1, p - 1))}
                disabled={clientPageClamped <= 1}
                className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 transition-colors hover:border-ai hover:text-ai disabled:pointer-events-none disabled:opacity-40"
              >
                ← Préc.
              </button>
              <span className="px-2 font-mono tabular-nums">
                Page {clientPageClamped} / {clientTotalPages}
              </span>
              <button
                onClick={() => setClientPage((p) => Math.min(clientTotalPages, p + 1))}
                disabled={clientPageClamped >= clientTotalPages}
                className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 transition-colors hover:border-ai hover:text-ai disabled:pointer-events-none disabled:opacity-40"
              >
                Suiv. →
              </button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
