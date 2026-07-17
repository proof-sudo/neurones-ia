"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGauge } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { TresoLineChart, VBarChart } from "@/components/charts/AnalyticsCharts";
import { FORECAST_MONTHS, FORECAST_OPPS } from "@/lib/fixtures/forecast";

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

      <Panel className="mb-4">
        <PanelHead title="Hypothèses de simulation">
          <AiChip>ajustez pour tester un scénario</AiChip>
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
        <PanelHead title="Détail mensuel" />
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
