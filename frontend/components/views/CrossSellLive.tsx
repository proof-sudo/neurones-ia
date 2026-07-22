"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AiChip } from "@/components/ui/AiChip";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { fmtM } from "@/lib/format";
import { generateCrossSellAnalysisAction } from "@/app/actions";
import type { MonteeValeurSignals, ValeurSignal } from "@/lib/api/crosssell";

type ValeurCategory = "cross_sell" | "up_sell" | "obsolete" | "renouvellement";

const CATEGORY_LABEL: Record<ValeurCategory, string> = {
  cross_sell: "Cross-sell",
  up_sell: "Up-sell",
  obsolete: "Obsolète",
  renouvellement: "Renouvellement",
};

export function CrossSellLive({ data }: { data: MonteeValeurSignals }) {
  const [tab, setTab] = useState<ValeurCategory>("cross_sell");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, startAnalyzing] = useTransition();

  function genererAnalyseTransversale() {
    setAnalysisError(null);
    startAnalyzing(async () => {
      const res = await generateCrossSellAnalysisAction();
      if (res.ok) setAnalysis(res.analysis);
      else setAnalysisError(res.error);
    });
  }

  const doublons = useMemo(() => {
    const compte = new Map<string, number>();
    Object.values(data)
      .flat()
      .forEach((o) => compte.set(o.client, (compte.get(o.client) ?? 0) + 1));
    return new Set([...compte.entries()].filter(([, n]) => n > 1).map(([name]) => name));
  }, [data]);

  const priorites = useMemo(() => {
    const withDoublon: ValeurSignal[] = [];
    const rest: ValeurSignal[] = [];
    Object.values(data)
      .flat()
      .forEach((o) => (doublons.has(o.client) ? withDoublon.push(o) : rest.push(o)));
    return [...withDoublon, ...rest].slice(0, 3);
  }, [data, doublons]);

  const items = data[tab];

  return (
    <>
      <ViewHeader
        eyebrow="● vente additionnelle"
        title="Montée en valeur"
        sub="Cross-sell, up-sell, obsolescence et renouvellements — détectés sur les vraies commandes"
      >
        <button
          onClick={genererAnalyseTransversale}
          disabled={analyzing}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          🔮 Analyse IA transversale
        </button>
      </ViewHeader>

      <p className="mb-4 text-[11.5px] leading-relaxed text-muted">
        Le classement dans chacun des 4 onglets est fait par règles automatiques (dates réelles,
        catégories produit détectées sur les commandes) — toujours actif, même sans IA. Le bouton
        IA ajoute une priorisation transversale entre les 4 catégories et une justification rédigée.
      </p>

      <SegmentedTabs
        tabs={(Object.keys(CATEGORY_LABEL) as ValeurCategory[]).map((key) => ({
          key,
          label: CATEGORY_LABEL[key],
        }))}
        active={tab}
        onChange={setTab}
      />

      {(analyzing || analysis || analysisError) && (
        <div className="mb-4 rounded-card border border-l-[3px] border-line border-l-ai bg-panel p-5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <AiChip>analyse</AiChip>
            <h3 className="text-[14.5px] font-semibold">Priorisation transversale IA</h3>
          </div>
          {analyzing && <AiChip>priorisation en cours…</AiChip>}
          {!analyzing && analysisError && (
            <div className="text-[12.5px] text-bad">Analyse indisponible : {analysisError}</div>
          )}
          {!analyzing && analysis && (
            <>
              <div className="mb-2.5 flex flex-col gap-2 text-[12.5px] leading-relaxed text-text">
                {analysis.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mb-1.5 text-[12.5px] font-medium text-text">
                Priorité de la semaine
              </div>
              {priorites.map((o, i) => (
                <div key={i} className="py-1 text-[12.5px] leading-relaxed text-text">
                  • <b>{o.client}</b> — {o.titre}
                  {doublons.has(o.client) && (
                    <span className="ml-1.5 text-[11px] text-ai">(double signal)</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <div className="text-[12.5px] text-muted">
            Aucune opportunité détectée dans cette catégorie pour l&apos;instant.
          </div>
        ) : (
          items.map((o, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-[18px]"
            >
              <h3 className="text-[13.5px] font-semibold">{o.client}</h3>
              <AiChip className="w-fit whitespace-normal text-left">{o.titre}</AiChip>
              <p className="text-[11.5px] leading-relaxed text-muted">{o.detail}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-[12px] text-ai">{fmtM(o.montant_xof)}</span>
                <Link
                  href={`/portefeuille?client=${encodeURIComponent(o.client)}`}
                  className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white"
                >
                  Voir le client
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
