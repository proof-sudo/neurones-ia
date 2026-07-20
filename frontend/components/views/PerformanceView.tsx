"use client";

import { useState } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { KpiGaugeRow } from "@/components/ui/KpiGauge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { HBarChart } from "@/components/charts/AnalyticsCharts";
import { LOST_BY_CLIENT, LOST_DEALS } from "@/lib/fixtures/forecast";

const RECOS = [
  { tag: "donnée manquante", html: 'Le CRM ne trace aucune <b>cause de perte</b> (pas de champ "lost_reason" alimenté). Recommandation : activer et rendre obligatoire ce champ dans Odoo pour permettre une vraie analyse des causes à l\'avenir.' },
  { tag: "concentration client", html: 'Les pertes sont <b>concentrées sur peu de clients</b> : MTN CI pèse à lui seul 19 585 M FCFA. Un pilotage par client (et non par commercial) est ici plus révélateur.' },
  { tag: "cycle de vente", html: "Le cycle de vente des dossiers perdus n'est pas calculable de façon fiable : la date de clôture (write_date) correspond souvent à une date de synchronisation en masse plutôt qu'à la vraie date de perte." },
  { tag: "écart valeur vs volume", html: "Le taux de victoire en valeur (24,3 %) est bien plus faible qu'en nombre (65,4 %) — les dossiers perdus sont structurellement plus gros que les dossiers gagnés, à investiguer en priorité sur les très gros comptes (MTN CI, BNI, BAD)." },
];

const TOP_CARDS = [
  { title: "🏆 Meilleur pays", text: "Côte d'Ivoire concentre la majorité du CA commandé 2025-2026 (211 clients sur 389 avec pays renseigné) et les plus gros comptes (Orange, MTN, Société Générale, BICICI)." },
  { title: "⚠️ Client le plus à risque (pertes)", text: "MTN CI concentre à lui seul 19 585 M FCFA d'opportunités perdues (105 sur la période) — largement le premier poste de pertes, devant tout autre client du portefeuille." },
  { title: "🏆 Meilleur client (CA) — à surveiller aussi", text: "La BAD est le 1ᵉʳ client par CA réel (4 419 M FCFA cumulés), mais c'est aussi le client avec l'impayé le plus lourd (1 682 M FCFA) — le plus gros compte porte aussi le plus gros risque de trésorerie." },
];

export function PerformanceView() {
  const [analysis, setAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const totalPerdu = LOST_DEALS.reduce((s, d) => s + d.montant, 0);
  const topClientPerdant = [...LOST_BY_CLIENT].sort((a, b) => b.montant - a.montant)[0];

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
        eyebrow="● intelligence commerciale"
        title="Performances"
        sub="Pays, clients — pas de suivi produit ni de cause de perte dans les données actuelles"
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
        ) : !analysis ? (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Analyse IA des performances » pour croiser le taux de victoire,
            l&apos;écart valeur/volume et les pertes par client.
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-[12.5px] leading-relaxed text-text">
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                L&apos;écart le plus révélateur
              </div>
              <p>
                Le taux de victoire en nombre (65,4%) est bien plus élevé qu&apos;en valeur (24,3%)
                — les dossiers <b>perdus</b> sont structurellement plus gros que les dossiers{" "}
                <b>gagnés</b>. L&apos;entreprise gagne souvent, mais perd gros — et c&apos;est
                concentré sur peu de clients.
              </p>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                Quel client prioriser
              </div>
              <p>
                <b>{topClientPerdant.name}</b> concentre à lui seul le plus haut montant perdu (
                {topClientPerdant.montant.toLocaleString("fr-FR")} M FCFA sur {topClientPerdant.n}{" "}
                opportunités) — largement devant tout autre client du portefeuille.
              </p>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                Recommandation
              </div>
              <p>
                Revue de compte dédiée sur {topClientPerdant.name} : comprendre pourquoi tant
                d&apos;opportunités y sont perdues avant de continuer à y investir du temps
                commercial au même rythme.
              </p>
            </div>
            <div className="font-mono text-[10px] leading-relaxed text-muted">
              Généré en mode simplifié — basé sur les vraies données de performance, lues côté
              client.
            </div>
          </div>
        )}
      </Panel>

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
          <PanelHead title="Pertes par client">
            <AiChip>où l&apos;entreprise perd le plus, en valeur réelle</AiChip>
          </PanelHead>
          <HBarChart
            labels={LOST_BY_CLIENT.map((c) => c.name)}
            values={LOST_BY_CLIENT.map((c) => c.montant)}
            label="Opportunités perdues (M FCFA)"
          />
        </Panel>
        <Panel>
          <PanelHead title="Constats IA" />
          <div className="flex flex-col gap-2.5">
            {RECOS.map((r, i) => (
              <div key={i} className="rounded-lg border border-line bg-panel-2 p-3">
                <AiChip>{r.tag}</AiChip>
                <p
                  className="mt-1.5 text-[11.5px] leading-relaxed text-muted [&_b]:font-semibold [&_b]:text-text"
                  dangerouslySetInnerHTML={{ __html: r.html }}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="rounded-card border border-line bg-panel p-5">
        <PanelHead title="Détail des plus grosses affaires perdues (réel, dédupliqué)" />
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
              {[...LOST_DEALS].sort((a, b) => b.montant - a.montant).map((d, i) => (
                <tr key={i} className="border-b border-line last:border-none">
                  <td className="px-2 py-2.5 text-text">{d.name}</td>
                  <td className="px-2 py-2.5">{d.client}</td>
                  <td className="px-2 py-2.5 font-mono text-bad">{d.montant.toLocaleString("fr-FR")} M FCFA</td>
                  <td className="px-2 py-2.5 text-muted">{d.commercial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
