"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGauge } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { DetailPanel, DetailGrid, DetailItem } from "@/components/ui/DetailPanel";
import { TresoLineChart, VBarChart } from "@/components/charts/AnalyticsCharts";
import { fmtM } from "@/lib/format";
import {
  generateTresorerieAnalysisAction,
  generateRecouvrementDecisionAction,
  type RecouvrementDecisionResult,
} from "@/app/actions";
import type { UnpaidData } from "@/lib/api/tresorerie";
import type { PipelineForecastData } from "@/lib/api/forecast";

const SIMULATEUR_TOOLTIP =
  "Le solde de départ et les charges fixes ci-dessous sont des hypothèses illustratives que vous pouvez ajuster — ce ne sont pas des chiffres réels d'Odoo. Les encaissements projetés viennent du forecast pondéré réel du pipeline.";

function severiteImpaye(jours: number): { label: string; color: string } {
  if (jours > 700) return { label: "Critique", color: "var(--color-bad)" };
  if (jours > 400) return { label: "Élevée", color: "var(--color-warn)" };
  return { label: "À surveiller", color: "var(--color-good)" };
}

const INPUT_CLASS =
  "w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

const INPUTS = [
  { id: "solde", label: "Trésorerie de départ (M FCFA) — valeur illustrative, aucun solde réel dans les données", def: 1500 },
  { id: "charges", label: "Charges fixes mensuelles (M FCFA)", def: 700 },
  { id: "marge", label: "Marge cible (%)", def: 30 },
  { id: "delai", label: "Délai moyen d'encaissement (jours)", def: 30 },
] as const;

export function TresorerieLive({
  unpaid,
  pipelineForecast,
}: {
  unpaid: UnpaidData;
  pipelineForecast: PipelineForecastData;
}) {
  const [v, setV] = useState<Record<string, number>>({ solde: 1500, charges: 700, marge: 30, delai: 30 });
  const [selectedImpaye, setSelectedImpaye] = useState<string | null>(null);
  const [decision, setDecision] = useState<RecouvrementDecisionResult | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionLoading, startDecision] = useTransition();

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, startAnalyzing] = useTransition();

  const debiteurs = unpaid.exposure.top_10_debiteurs;
  const impaye = debiteurs.find((d) => d.client === selectedImpaye) ?? null;
  const impayeSev = impaye ? severiteImpaye(impaye.retard_max_jours) : null;

  function genererAnalyse() {
    setAnalysisError(null);
    startAnalyzing(async () => {
      const res = await generateTresorerieAnalysisAction();
      if (res.ok) setAnalysis(res.analysis);
      else setAnalysisError(res.error);
    });
  }

  function selectImpaye(client: string) {
    if (selectedImpaye === client) {
      setSelectedImpaye(null);
      setDecision(null);
      setDecisionError(null);
      return;
    }
    setSelectedImpaye(client);
    setDecision(null);
    setDecisionError(null);
    startDecision(async () => {
      const res = await generateRecouvrementDecisionAction(client);
      if (res.ok) setDecision(res.decision);
      else setDecisionError(res.error);
    });
  }

  const months = pipelineForecast.month_labels;

  const calc = useMemo(() => {
    const bReal = pipelineForecast.monthly_buckets.realiste_xof.map((val) => Math.round(val / 1_000_000));
    const shift = Math.round((v.delai || 0) / 30);
    const encaissements = new Array(6).fill(0);
    bReal.forEach((val, i) => {
      const j = Math.min(i + shift, 5);
      encaissements[j] += val;
    });

    let solde = v.solde || 0;
    const soldes: number[] = [];
    const fluxNet: number[] = [];
    const marges: number[] = [];
    for (let i = 0; i < 6; i++) {
      const enc = encaissements[i];
      const net = enc - (v.charges || 0);
      solde += net;
      soldes.push(Math.round(solde));
      fluxNet.push(Math.round(net));
      marges.push(Math.round((enc * (v.marge || 0)) / 100));
    }
    return { encaissements, soldes, fluxNet, marges };
  }, [v, pipelineForecast.monthly_buckets.realiste_xof]);

  const { encaissements, soldes, fluxNet, marges } = calc;
  const minFlux = Math.min(...fluxNet);
  const moisTendu = months[fluxNet.indexOf(minFlux)];
  const margeCumul = marges.reduce((a, b) => a + b, 0);

  const exposition = unpaid.exposure;

  return (
    <>
      <ViewHeader
        eyebrow="● prévisions financières élargies"
        title="Trésorerie & marges prévisionnelles"
        sub="Simulation de la trésorerie et des marges futures à partir du forecast commercial réel"
      >
        <button
          onClick={genererAnalyse}
          disabled={analyzing}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          ⚡ Analyse IA de la trésorerie
        </button>
      </ViewHeader>

      <Panel className="mb-4 border-l-[3px] border-l-ai">
        <PanelHead title="Ce que l'IA voit dans la trésorerie">
          <AiChip>analyse</AiChip>
        </PanelHead>
        {analyzing ? (
          <AiChip>analyse en cours…</AiChip>
        ) : analysisError ? (
          <div className="text-[12.5px] text-bad">Analyse indisponible : {analysisError}</div>
        ) : !analysis ? (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Analyse IA de la trésorerie » pour une lecture qualitative rédigée par
            Claude à partir de l&apos;exposition réelle aux impayés.
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-text">
            {analysis.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </Panel>

      <DetailPanel
        open={!!impaye}
        title={impaye ? `Décision recouvrement — ${impaye.client}` : ""}
        onClose={() => {
          setSelectedImpaye(null);
          setDecision(null);
          setDecisionError(null);
        }}
      >
        {impaye && impayeSev && (
          <DetailGrid>
            <DetailItem k="Montant échu">{fmtM(impaye.montant_total_xof)}</DetailItem>
            <DetailItem k="Retard" valueClassName="text-bad">
              {impaye.retard_max_jours} jours
            </DetailItem>
            <DetailItem k="Sévérité">
              <span style={{ color: impayeSev.color }}>{impayeSev.label}</span>
            </DetailItem>
            <DetailItem k={`Part du total impayés (${fmtM(exposition.exposition_totale_xof)})`}>
              {exposition.exposition_totale_xof
                ? ((impaye.montant_total_xof / exposition.exposition_totale_xof) * 100).toFixed(1)
                : "0"}
              %
            </DetailItem>
            <DetailItem k="Décision recommandée" full valueClassName="text-[12.5px] font-medium leading-relaxed">
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
                    — niveau d&apos;urgence borné par le retard réel, jamais laissé au seul LLM.
                  </div>
                </>
              ) : null}
            </DetailItem>
          </DetailGrid>
        )}
      </DetailPanel>

      <Panel className="mb-4">
        <PanelHead title="Impayés par client">
          <AiChip>cliquez sur un client pour la décision de recouvrement</AiChip>
        </PanelHead>
        <div className="mb-3 text-[12px] text-muted">
          Les plus gros débiteurs du portefeuille (sur {fmtM(exposition.exposition_totale_xof)}
          {" "}d&apos;impayés échus au total, {exposition.nb_factures_impayees} factures). Cliquez sur un
          client pour la décision.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {["Client", "Montant échu", "Retard", "Sévérité"].map((h) => (
                  <th key={h} className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {debiteurs.map((d) => {
                const sev = severiteImpaye(d.retard_max_jours);
                return (
                  <tr
                    key={d.client}
                    onClick={() => selectImpaye(d.client)}
                    className={clsx(
                      "cursor-pointer border-b border-line last:border-none transition-colors hover:bg-panel-2",
                      selectedImpaye === d.client && "bg-panel-2",
                    )}
                  >
                    <td className="px-2 py-2.5 font-medium text-text">{d.client}</td>
                    <td className="px-2 py-2.5 font-mono">{fmtM(d.montant_total_xof)}</td>
                    <td className="px-2 py-2.5 font-mono text-bad">{d.retard_max_jours} jours</td>
                    <td className="px-2 py-2.5">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white"
                        style={{ backgroundColor: sev.color }}
                      >
                        {sev.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mb-[22px] grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiGauge
          color="var(--color-good)"
          label="Trésorerie à 6 mois"
          value={`${soldes[5].toLocaleString("fr-FR")} M FCFA`}
          delta={`${soldes[5] >= v.solde ? "▲" : "▼"} vs solde de départ (${v.solde} M FCFA)`}
          deltaVariant={soldes[5] >= v.solde ? "up" : "down"}
        />
        <KpiGauge
          color="var(--color-ai)"
          label="Marge cumulée estimée"
          value={`${margeCumul.toLocaleString("fr-FR")} M FCFA`}
          delta={`sur la base d'une marge cible de ${v.marge}%`}
        />
        <KpiGauge
          color="var(--color-warn)"
          label="Mois le plus tendu"
          value={moisTendu}
          delta={`flux net ${minFlux.toLocaleString("fr-FR")} M FCFA`}
          deltaVariant="down"
        />
        <KpiGauge
          color="var(--color-ai)"
          label="Charges fixes mensuelles"
          value={`${v.charges} M FCFA`}
          delta="hypothèse ajustable ci-dessous"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHead title="Trésorerie prévisionnelle cumulée">
            <AiChip>6 mois glissants</AiChip>
          </PanelHead>
          <TresoLineChart labels={months} values={soldes} label="Trésorerie cumulée (M FCFA)" />
        </Panel>
        <Panel>
          <PanelHead title="Marge prévisionnelle" />
          <VBarChart labels={months} values={marges} label="Marge estimée (M FCFA)" />
        </Panel>
      </div>

      <Panel className="mb-4 border-l-[3px] border-l-warn">
        <PanelHead
          title={
            <span className="inline-flex items-center gap-1.5">
              Simulateur exploratoire
              <span className="cursor-help text-[13px] font-normal text-muted" title={SIMULATEUR_TOOLTIP}>
                ⓘ
              </span>
            </span>
          }
        >
          <AiChip>hypothèses ajustables, encaissements sur pipeline réel</AiChip>
        </PanelHead>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {INPUTS.map((inp) => (
            <div key={inp.id}>
              <div className="mb-1.5 text-[11.5px] text-muted">{inp.label}</div>
              <input
                type="number"
                className={INPUT_CLASS}
                value={Number.isFinite(v[inp.id]) ? v[inp.id] : ""}
                onChange={(e) => setV((prev) => ({ ...prev, [inp.id]: parseFloat(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      </Panel>

      <div className="rounded-card border border-line bg-panel p-5">
        <PanelHead title="Détail mensuel (simulation)" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {["Mois", "Encaissements", "Décaissements", "Flux net", "Trésorerie cumulée", "Marge estimée"].map((h) => (
                  <th key={h} className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={m} className="border-b border-line last:border-none">
                  <td className="px-2 py-2.5 text-text">{m}</td>
                  <td className="px-2 py-2.5 font-mono">{Math.round(encaissements[i]).toLocaleString("fr-FR")} M FCFA</td>
                  <td className="px-2 py-2.5 font-mono">{(v.charges || 0).toLocaleString("fr-FR")} M FCFA</td>
                  <td className={clsx("px-2 py-2.5 font-mono", fluxNet[i] >= 0 ? "text-good" : "text-bad")}>
                    {fluxNet[i] >= 0 ? "+" : ""}
                    {fluxNet[i].toLocaleString("fr-FR")} M FCFA
                  </td>
                  <td className="px-2 py-2.5 font-mono">{soldes[i].toLocaleString("fr-FR")} M FCFA</td>
                  <td className="px-2 py-2.5 font-mono text-ai">{marges[i].toLocaleString("fr-FR")} M FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
