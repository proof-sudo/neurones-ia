"use client";

import { useMemo, useState } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { ClientModal } from "./ClientsView";
import {
  classifierMonteeValeur,
  VALEUR_CATEGORY_LABEL,
  type ValeurCategory,
  type ValeurOpportunity,
} from "@/lib/valeur";
import { CLIENT_PROFILES } from "@/lib/fixtures/clients";
import type { ClientProfile } from "@/lib/types";

export function CrossSellView() {
  const data = useMemo(() => classifierMonteeValeur(), []);
  const [tab, setTab] = useState<ValeurCategory>("crosssell");
  const [selected, setSelected] = useState<ClientProfile | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysed, setAnalysed] = useState(false);

  function genererAnalyseTransversale() {
    setAnalysing(true);
    setAnalysed(false);
    setTimeout(() => {
      setAnalysing(false);
      setAnalysed(true);
    }, 700);
  }

  function openClient(name: string) {
    setSelected(CLIENT_PROFILES.find((c) => c.name === name) ?? null);
  }

  const doublons = useMemo(() => {
    const compte = new Map<string, number>();
    Object.values(data)
      .flat()
      .forEach((o) => compte.set(o.client, (compte.get(o.client) ?? 0) + 1));
    return [...compte.entries()].filter(([, n]) => n > 1).map(([name]) => name);
  }, [data]);

  const priorites = useMemo(() => {
    const withDoublon: ValeurOpportunity[] = [];
    const rest: ValeurOpportunity[] = [];
    Object.values(data)
      .flat()
      .forEach((o) => (doublons.includes(o.client) ? withDoublon.push(o) : rest.push(o)));
    return [...withDoublon, ...rest].slice(0, 3);
  }, [data, doublons]);

  return (
    <>
      <ViewHeader
        eyebrow="● vente additionnelle"
        title="Montée en valeur"
        sub="Cross-sell, up-sell, obsolescence et renouvellements — classés par règles réelles sur le portefeuille"
      >
        <button
          onClick={genererAnalyseTransversale}
          disabled={analysing}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          🔮 Analyse IA transversale
        </button>
      </ViewHeader>

      <p className="mb-4 text-[11.5px] leading-relaxed text-muted">
        Le classement dans chacun des 4 onglets est fait par règles automatiques (dates
        réelles, mots-clés) — toujours actif, même sans IA. Le bouton IA ajoute une
        priorisation transversale entre les 4 catégories et une justification rédigée.
      </p>

      <SegmentedTabs
        tabs={(Object.keys(VALEUR_CATEGORY_LABEL) as ValeurCategory[]).map((key) => ({
          key,
          label: VALEUR_CATEGORY_LABEL[key],
        }))}
        active={tab}
        onChange={setTab}
      />

      {(analysing || analysed) && (
        <div className="mb-4 rounded-card border border-l-[3px] border-line border-l-ai bg-panel p-5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <AiChip>analyse</AiChip>
            <h3 className="text-[14.5px] font-semibold">Priorisation transversale IA</h3>
          </div>
          {analysing && <AiChip>priorisation en cours…</AiChip>}
          {analysed && (
            <>
              <div className="mb-2.5 text-[12.5px] font-medium text-text">
                Priorité de la semaine
              </div>
              {priorites.map((o, i) => (
                <div key={i} className="py-1 text-[12.5px] leading-relaxed text-text">
                  • <b>{o.client}</b> — {o.titre}
                  {doublons.includes(o.client) && (
                    <span className="ml-1.5 text-[11px] text-ai">(double signal)</span>
                  )}
                </div>
              ))}
              <div className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
                Priorisation calculée à partir des 4 listes ci-dessous — la rédaction
                argumentée par le LLM se branchera côté serveur dans une prochaine vague.
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {data[tab].length === 0 ? (
          <div className="text-[12.5px] text-muted">
            Aucune opportunité détectée dans cette catégorie pour l&apos;instant.
          </div>
        ) : (
          data[tab].map((o, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-[18px]"
            >
              <h3 className="text-[13.5px] font-semibold">{o.client}</h3>
              <AiChip className="w-fit whitespace-normal text-left">{o.titre}</AiChip>
              <p className="text-[11.5px] leading-relaxed text-muted">{o.detail}</p>
              <div className="mt-1">
                <button
                  onClick={() => openClient(o.client)}
                  className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white"
                >
                  Voir le client
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ClientModal client={selected} onClose={() => setSelected(null)} />
    </>
  );
}
