"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Panel } from "@/components/ui/Panel";
import { CaChart } from "@/components/charts/DashboardCharts";
import { FaitCard } from "./FaitCard";
import {
  COMMERCIAUX_CA,
  COMMERCIAUX_NAMES,
  KPI_DETAILS,
  MARCHES_PAR_PAYS,
  PERIOD_DATA,
  SECTEUR_LABELS,
  SECTEUR_VALUES,
  TOP_CLIENTS,
  TOP_DEAL_BY_COMMERCIAL,
} from "@/lib/fixtures/dashboard";
import { CLIENT_PROFILES } from "@/lib/fixtures/clients";
import { FORECAST_OPPS } from "@/lib/fixtures/forecast";
import type { KpiDetail, PeriodKey } from "@/lib/types";

type DeltaVariant = "up" | "down" | "flag" | "none";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "mois", label: "Mois" },
  { key: "trimestre", label: "Trimestre" },
  { key: "annee", label: "Année" },
];

const GAUGES: {
  key: keyof typeof KPI_DETAILS;
  topColor: string;
  delta: DeltaVariant;
}[] = [
  { key: "ca", topColor: "var(--color-good)", delta: "up" },
  { key: "objectif", topColor: "var(--color-ai)", delta: "flag" },
  { key: "marge", topColor: "var(--color-good)", delta: "up" },
  { key: "pipeline", topColor: "var(--color-ai)", delta: "none" },
  { key: "transfo", topColor: "var(--color-bad)", delta: "down" },
];

const DELTA_CLASS: Record<DeltaVariant, string> = {
  up: "text-good",
  down: "text-bad",
  flag: "text-warn",
  none: "text-muted",
};

function fmtM(v: number): string {
  return `${Math.round(v).toLocaleString("fr-FR")} M FCFA`;
}

export function DashboardView() {
  const [period, setPeriod] = useState<PeriodKey>("trimestre");
  const [commercial, setCommercial] = useState("");
  const [secteur, setSecteur] = useState("");
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [projLoading, setProjLoading] = useState(false);
  const [projection, setProjection] = useState<{
    realiste: number;
    pessimiste: number;
    optimiste: number;
  } | null>(null);

  const pd = PERIOD_DATA[period];

  function genererProjection() {
    setProjLoading(true);
    setProjection(null);
    setTimeout(() => {
      const realiste = FORECAST_OPPS.reduce((s, o) => s + (o.val * o.prob) / 100, 0);
      const pessimiste = FORECAST_OPPS.filter((o) => o.prob >= 50).reduce(
        (s, o) => s + (o.val * o.prob) / 100,
        0,
      );
      const optimiste =
        realiste +
        FORECAST_OPPS.filter((o) => o.prob < 50).reduce((s, o) => s + o.val * 0.5, 0);
      setProjection({ realiste, pessimiste, optimiste });
      setProjLoading(false);
    }, 700);
  }

  // --- KPI values (logique de applyDashboardFilters du mockup) ---
  const commercialIdx = COMMERCIAUX_NAMES.indexOf(commercial);
  const totalComm = COMMERCIAUX_CA.reduce((a, b) => a + b, 0);
  const kpiValues: Record<string, { label: string; value: string; delta: string }> = {
    ca: commercial
      ? {
          label: `CA (2025-2026) — ${commercial}`,
          value: `${COMMERCIAUX_CA[commercialIdx]} M FCFA`,
          delta: `part du CA des 5 meilleurs commerciaux : ${Math.round(
            (COMMERCIAUX_CA[commercialIdx] / totalComm) * 100,
          )} %`,
        }
      : { label: pd.caLabel, value: pd.ca, delta: pd.caDelta },
    objectif: { label: "Rythme vs 2025", value: pd.objectif, delta: pd.objectifDelta },
    marge: { label: "Marge commerciale", value: pd.marge, delta: pd.margeDelta },
    pipeline: { label: "Pipeline ouvert", value: pd.pipeline, delta: pd.pipelineDelta },
    transfo: { label: "Taux de transformation", value: pd.transfo, delta: pd.transfoDelta },
  };

  // --- Faits marquants (port de renderApercuRapide du mockup) ---
  const totalPays = SECTEUR_VALUES.reduce((a, b) => a + b, 0);
  const paysIdx = secteur
    ? SECTEUR_LABELS.indexOf(secteur)
    : SECTEUR_VALUES.indexOf(Math.max(...SECTEUR_VALUES));
  const paysPct = Math.round((SECTEUR_VALUES[paysIdx] / totalPays) * 100);

  const comIdx = commercial
    ? COMMERCIAUX_NAMES.indexOf(commercial)
    : COMMERCIAUX_CA.indexOf(Math.max(...COMMERCIAUX_CA));

  const clientsPool = secteur
    ? TOP_CLIENTS.filter((c) => c.secteur === secteur)
    : TOP_CLIENTS;
  const topClient = [...(clientsPool.length ? clientsPool : TOP_CLIENTS)].sort(
    (a, b) => b.ca - a.ca,
  )[0];

  const marchesPays = MARCHES_PAR_PAYS[SECTEUR_LABELS[paysIdx]];
  const dealCom = TOP_DEAL_BY_COMMERCIAL[COMMERCIAUX_NAMES[comIdx]];
  const clientHist = CLIENT_PROFILES.find((c) => c.name === topClient.name);

  const faitsDetails: Record<string, KpiDetail> = {
    faitPays: {
      title: `Détail — Marchés réels importants en ${SECTEUR_LABELS[paysIdx]}`,
      items: marchesPays
        ? marchesPays.map((m) => [`${m.projet} — ${m.client}`, `${m.montant} M FCFA`])
        : [
            [
              `Aucun marché détaillé pour ${SECTEUR_LABELS[paysIdx]} dans les données actuelles`,
              "—",
            ],
          ],
    },
    faitCommercial: {
      title: `Détail — Marché apporté par ${COMMERCIAUX_NAMES[comIdx]}`,
      items: dealCom
        ? [
            [`${dealCom.projet} — ${dealCom.client}`, `${dealCom.montant} M FCFA`],
            [
              "CA total réel apporté 2025-2026 (sale_orders Odoo)",
              `${COMMERCIAUX_CA[comIdx]} M FCFA`,
            ],
          ]
        : [["Aucun marché détaillé pour ce commercial", "—"]],
    },
    faitClient: {
      title: `Détail — Montant des projets réalisés par ${topClient.name}`,
      items: [
        ["Montant total réel (CA cumulé 2025-2026)", `${topClient.ca} M FCFA`] as [
          string,
          string,
        ],
      ].concat(
        clientHist
          ? clientHist.historique.map(
              (h) => [`${h.titre} (${h.periode})`, "montant non détaillé"] as [string, string],
            )
          : [["Historique non détaillé pour ce client", "—"] as [string, string]],
      ),
    },
  };

  // --- status line ---
  const statusParts: string[] = [];
  if (period !== "trimestre")
    statusParts.push(`période : ${PERIODS.find((p) => p.key === period)!.label}`);
  if (commercial) statusParts.push(`commercial : ${commercial}`);
  if (secteur) statusParts.push(`pays : ${secteur}`);

  function resetFilters() {
    setPeriod("trimestre");
    setCommercial("");
    setSecteur("");
  }

  const detail = openDetail ? (KPI_DETAILS[openDetail] ?? faitsDetails[openDetail]) : null;

  return (
    <>
      {/* ===== HEADER ===== */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
            ● cockpit commercial — pilotage IA
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">
            Bonjour, voici votre lecture du jour
          </h1>
          <div className="mt-1 text-[13px] text-muted">
            Neurones Technologies — Sales IA — Cockpit prédictif
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
            value={commercial}
            onChange={(e) => setCommercial(e.target.value)}
          >
            <option value="">Tous les commerciaux</option>
            {COMMERCIAUX_NAMES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select
            className="cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
          >
            <option value="">Tous les pays</option>
            {SECTEUR_LABELS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-1 rounded-[10px] border border-line bg-panel p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={clsx(
                  "cursor-pointer rounded-[7px] px-3 py-[7px] font-mono text-xs",
                  period === p.key ? "bg-ai text-white" : "text-muted",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== INSTRUMENTS (gauges) ===== */}
      <div className="mb-[22px] grid grid-cols-2 gap-3.5 xl:grid-cols-5">
        {GAUGES.map((g) => {
          const v = kpiValues[g.key];
          return (
            <button
              key={g.key}
              onClick={() =>
                setOpenDetail((cur) => (cur === g.key ? null : (g.key as string)))
              }
              className="group relative cursor-pointer overflow-hidden rounded-card border border-line bg-panel px-4 pb-3.5 pt-4 text-left transition hover:-translate-y-px hover:border-[#39466B]"
            >
              <span
                className="absolute left-0 top-0 h-0.5 w-full opacity-70"
                style={{ background: g.topColor }}
              />
              <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-muted">
                {v.label}
              </div>
              <div className="font-mono text-[22px] font-semibold tracking-[-0.01em]">
                {v.value}
              </div>
              <div className={clsx("mt-1.5 font-mono text-xs", DELTA_CLASS[g.delta])}>
                {v.delta}
              </div>
              <div className="absolute bottom-2.5 right-3 font-mono text-[9.5px] text-[#3A4668]">
                détail ↓
              </div>
            </button>
          );
        })}
      </div>

      {statusParts.length > 0 && (
        <div className="-mt-2.5 mb-[18px] font-mono text-[10px] text-muted">
          Filtres actifs — {statusParts.join(" · ")}{" "}
          <button onClick={resetFilters} className="cursor-pointer text-ai underline">
            réinitialiser
          </button>
        </div>
      )}

      {/* ===== DÉTAIL DRILL-DOWN ===== */}
      {detail && (
        <div className="mb-[22px] rounded-card border border-ai bg-panel px-5 py-[18px]">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm">{detail.title}</h3>
            <button
              onClick={() => setOpenDetail(null)}
              className="cursor-pointer text-[13px] text-muted"
            >
              Fermer ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {detail.items.map(([k, val]) => (
              <div key={k}>
                <div className="mb-1 text-[11px] text-muted">{k}</div>
                <div className="font-mono text-[15px]">{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CHART CA + FAITS MARQUANTS ===== */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14.5px] font-semibold">Évolution du CA — réalisé</h3>
            <AiChip>Données réelles Odoo (commandes)</AiChip>
          </div>
          <CaChart period={pd} />
        </Panel>
        <Panel>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14.5px] font-semibold">Faits marquants</h3>
          </div>
          <div className="flex flex-col gap-3">
            <FaitCard
              topColor="var(--color-ai)"
              label={secteur ? "Pays sélectionné" : "Top pays"}
              value={SECTEUR_LABELS[paysIdx]}
              delta={`${paysPct}% des clients`}
              deltaClass="text-muted"
              onClick={() =>
                setOpenDetail((cur) => (cur === "faitPays" ? null : "faitPays"))
              }
            />
            <FaitCard
              topColor="var(--color-good)"
              label={commercial ? "Commercial sélectionné" : "Top commercial"}
              value={COMMERCIAUX_NAMES[comIdx]}
              delta={`${COMMERCIAUX_CA[comIdx]} M FCFA`}
              deltaClass="text-good"
              onClick={() =>
                setOpenDetail((cur) => (cur === "faitCommercial" ? null : "faitCommercial"))
              }
            />
            <FaitCard
              topColor="var(--color-warn)"
              label={secteur ? `Top client — ${secteur}` : "Top client"}
              value={topClient.name}
              delta={`${topClient.ca} M FCFA cumulés`}
              deltaClass="text-muted"
              onClick={() =>
                setOpenDetail((cur) => (cur === "faitClient" ? null : "faitClient"))
              }
            />
          </div>
        </Panel>
      </div>

      {/* ===== PROJECTION IA & RECOMMANDATION ===== */}
      <Panel className="mt-4 border-l-[3px] border-l-good">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[14.5px] font-semibold">
            <AiChip>projection</AiChip>
            Projection IA &amp; recommandation
          </h3>
          <button
            onClick={genererProjection}
            disabled={projLoading}
            className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
          >
            🔮 Générer une projection
          </button>
        </div>

        {projLoading && <AiChip>calcul de la projection…</AiChip>}

        {!projLoading && !projection && (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Générer une projection » pour une projection chiffrée de la
            trajectoire à venir, avec une recommandation concrète associée — basée sur le
            pipeline pondéré réel.
          </div>
        )}

        {!projLoading && projection && (
          <div className="rounded-card bg-panel-2 p-4">
            <Section title="Projection">
              <p className="text-[13px] leading-relaxed text-text">
                Sur la base du pipeline pondéré réel, le CA des 6 prochains mois est estimé
                entre <b>{fmtM(projection.pessimiste)}</b> (scénario prudent) et{" "}
                <b>{fmtM(projection.optimiste)}</b> (scénario optimiste), avec un scénario
                réaliste autour de <b>{fmtM(projection.realiste)}</b>. Cette estimation
                reste incertaine : elle dépend de la conversion effective des opportunités
                en cours, et le CA 2026 est déjà en retrait de 1 785 M FCFA par rapport à
                2025 sur la même période.
              </p>
            </Section>
            <Section title="Recommandation">
              <p className="text-[12px] leading-relaxed text-muted">
                Concentrer les efforts sur les opportunités à ≥ 50 % de probabilité (le
                socle du scénario prudent) pour sécuriser ce plancher avant de viser le
                scénario optimiste, tout en traitant en parallèle le risque de trésorerie
                déjà signalé (impayés échus).
              </p>
            </Section>
            <div className="mt-1 font-mono text-[10px] leading-relaxed text-muted">
              Généré en mode simplifié (sans IA générative) — basé sur le pipeline pondéré
              réel.
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <h4 className="mb-2 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}
