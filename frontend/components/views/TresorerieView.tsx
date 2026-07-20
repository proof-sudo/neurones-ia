"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGauge } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { DetailPanel, DetailGrid, DetailItem } from "@/components/ui/DetailPanel";
import { TresoLineChart, VBarChart } from "@/components/charts/AnalyticsCharts";
import {
  FORECAST_MONTHS,
  FORECAST_OPPS,
  IMPAYES_PAR_CLIENT,
  TOTAL_IMPAYES,
  severiteImpaye,
  type Impaye,
} from "@/lib/fixtures/forecast";

const SIMULATEUR_TOOLTIP =
  "Le solde de départ et les charges fixes ci-dessous sont des hypothèses illustratives que vous pouvez ajuster — ce ne sont pas des chiffres réels d'Odoo. Utilisez ce simulateur pour tester des scénarios, pas comme donnée de référence.";

/** Décision de recouvrement par règles sur le retard réel (repli local, comme le mockup). */
function decisionRecouvrement(i: Impaye): { decision: React.ReactNode; action: string } {
  if (i.jours > 700) {
    return {
      decision: (
        <>
          <b>Recouvrement d&apos;urgence.</b> {i.jours} jours de retard — c&apos;est l&apos;impayé le
          plus ancien du portefeuille, proche du seuil où une créance devient comptablement
          irrécouvrable.
        </>
      ),
      action:
        "Escalade immédiate (Direction Financière + Direction Commerciale) sous 5 jours, avant provision pour créance douteuse.",
    };
  }
  if (i.jours > 400) {
    return {
      decision: (
        <>
          <b>Plan de recouvrement structuré.</b> Montant significatif ({i.montant} M FCFA) en
          souffrance depuis plus d&apos;un an
          {i.souffrance ? `, dont ${i.souffrance} M FCFA depuis ${i.jours} jours` : ""} — nécessite
          un suivi dédié, pas une simple relance.
        </>
      ),
      action:
        "Mettre en place une cellule de recouvrement dédiée avec échéancier formel sous 15 jours.",
    };
  }
  return {
    decision: (
      <>
        <b>Relance active.</b> {i.jours} jours de retard — encore dans une fenêtre où une relance
        ferme peut suffire.
      </>
    ),
    action: "Relance formelle sous 7 jours, avant que le dossier ne s'aggrave.",
  };
}

const INPUT_CLASS =
  "w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

const INPUTS = [
  { id: "solde", label: "Trésorerie de départ (M FCFA) — valeur illustrative, aucun solde réel dans les données", def: 1500 },
  { id: "charges", label: "Charges fixes mensuelles (M FCFA)", def: 700 },
  { id: "marge", label: "Marge cible (%)", def: 30 },
  { id: "delai", label: "Délai moyen d'encaissement (jours)", def: 30 },
] as const;

export function TresorerieView() {
  const [v, setV] = useState<Record<string, number>>({ solde: 1500, charges: 700, marge: 30, delai: 30 });
  const [selectedImpaye, setSelectedImpaye] = useState<string | null>(null);

  const impaye = IMPAYES_PAR_CLIENT.find((i) => i.client === selectedImpaye) ?? null;
  const decision = impaye ? decisionRecouvrement(impaye) : null;
  const impayeSev = impaye ? severiteImpaye(impaye.jours) : null;

  const calc = useMemo(() => {
    const bReal = new Array(6).fill(0);
    FORECAST_OPPS.forEach((o) => {
      const idx = Math.min(o.offset, 5);
      bReal[idx] += (o.val * o.prob) / 100;
    });
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
  }, [v]);

  const { encaissements, soldes, fluxNet, marges } = calc;
  const minFlux = Math.min(...fluxNet);
  const moisTendu = FORECAST_MONTHS[fluxNet.indexOf(minFlux)];
  const margeCumul = marges.reduce((a, b) => a + b, 0);

  return (
    <>
      <ViewHeader
        eyebrow="● prévisions financières élargies"
        title="Trésorerie & marges prévisionnelles"
        sub="Simulation de la trésorerie et des marges futures à partir du forecast commercial"
      >
        <AiChip>simulation ajustable</AiChip>
      </ViewHeader>

      <DetailPanel
        open={!!impaye}
        title={impaye ? `Décision recouvrement — ${impaye.client}` : ""}
        onClose={() => setSelectedImpaye(null)}
      >
        {impaye && decision && impayeSev && (
          <DetailGrid>
            <DetailItem k="Montant échu">{impaye.montant} M FCFA</DetailItem>
            <DetailItem k="Retard" valueClassName="text-bad">
              {impaye.jours} jours
            </DetailItem>
            <DetailItem k="Sévérité">
              <span style={{ color: impayeSev.color }}>{impayeSev.label}</span>
            </DetailItem>
            <DetailItem k={`Part du total impayés (${(TOTAL_IMPAYES / 1000).toFixed(2)} Md FCFA)`}>
              {((impaye.montant / TOTAL_IMPAYES) * 100).toFixed(1)}%
            </DetailItem>
            <DetailItem k="Décision recommandée" full valueClassName="text-[12.5px] font-medium leading-relaxed">
              {decision.decision}
            </DetailItem>
            <DetailItem k="Première action" full valueClassName="text-[12.5px] font-medium leading-relaxed">
              {decision.action}
            </DetailItem>
          </DetailGrid>
        )}
      </DetailPanel>

      <Panel className="mb-4">
        <PanelHead title="Impayés par client">
          <AiChip>cliquez sur un client pour la décision de recouvrement</AiChip>
        </PanelHead>
        <div className="mb-3 text-[12px] text-muted">
          Les 3 impayés réels les plus critiques du portefeuille (sur {(TOTAL_IMPAYES / 1000).toFixed(2)} Md
          FCFA d&apos;impayés échus au total, 842 factures). Cliquez sur un client pour la décision.
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
              {IMPAYES_PAR_CLIENT.map((i) => {
                const sev = severiteImpaye(i.jours);
                return (
                  <tr
                    key={i.client}
                    onClick={() => setSelectedImpaye((cur) => (cur === i.client ? null : i.client))}
                    className={clsx(
                      "cursor-pointer border-b border-line last:border-none transition-colors hover:bg-panel-2",
                      selectedImpaye === i.client && "bg-panel-2",
                    )}
                  >
                    <td className="px-2 py-2.5 font-medium text-text">{i.client}</td>
                    <td className="px-2 py-2.5 font-mono">{i.montant} M FCFA</td>
                    <td className="px-2 py-2.5 font-mono text-bad">{i.jours} jours</td>
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
          <TresoLineChart labels={FORECAST_MONTHS} values={soldes} label="Trésorerie cumulée (M FCFA)" />
        </Panel>
        <Panel>
          <PanelHead title="Marge prévisionnelle" />
          <VBarChart labels={FORECAST_MONTHS} values={marges} label="Marge estimée (M FCFA)" />
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
          <AiChip>hypothèses ajustables, non réelles</AiChip>
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
              {FORECAST_MONTHS.map((m, i) => (
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
