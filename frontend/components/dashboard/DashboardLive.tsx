"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { CaChart } from "@/components/charts/DashboardCharts";
import { fmtInt, fmtM, fmtPct } from "@/lib/format";
import { FORECAST_OPPS, VIGILANCE_IMPAYES } from "@/lib/fixtures/forecast";
import { EXPOSITION_FOURNISSEURS } from "@/lib/fixtures/partners";
import type { DashboardKpis, SalespersonRevenue } from "@/lib/api/dashboard";
import type { PeriodKey } from "@/lib/types";

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const MONTH_FULL = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "mois", label: "Mois" },
  { key: "trimestre", label: "Trimestre" },
  { key: "annee", label: "Année" },
];

type DeltaVariant = "up" | "down" | "flag" | "none";
const DELTA_CLASS: Record<DeltaVariant, string> = {
  up: "text-good",
  down: "text-bad",
  flag: "text-warn",
  none: "text-muted",
};

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// ---- Points de vigilance (données réelles, calculées une fois) ----
const IMPAYE_CRITIQUE = VIGILANCE_IMPAYES[0]; // le plus ancien
const OPP_CRITIQUE =
  [...FORECAST_OPPS].filter((o) => o.risk).sort((a, b) => b.val * b.prob - a.val * a.prob)[0] ??
  [...FORECAST_OPPS].sort((a, b) => b.val * b.prob - a.val * a.prob)[0];
const FOURN_CRITIQUE = EXPOSITION_FOURNISSEURS[0]; // exposition la plus forte

const VIGILANCE_DETAILS: Record<string, { title: string; items: [string, string][] }> = {
  faitImpaye: {
    title: `Détail — Impayé ${IMPAYE_CRITIQUE.client}`,
    items: [
      ["Montant échu", `${IMPAYE_CRITIQUE.montant} M FCFA`],
      ["Retard", `${IMPAYE_CRITIQUE.jours} jours — le plus ancien du portefeuille`],
      ["Pourquoi c’est critique", IMPAYE_CRITIQUE.contexte],
      ["Action recommandée", "Plan de recouvrement d’urgence sous 5 jours (DAF + Direction Commerciale), avant provision pour créance douteuse."],
    ],
  },
  faitOpportunite: {
    title: `Détail — ${OPP_CRITIQUE.name}`,
    items: [
      ["Client", OPP_CRITIQUE.client],
      ["Montant", `${OPP_CRITIQUE.val} M FCFA (probabilité déclarée : ${OPP_CRITIQUE.prob}%)`],
      ["Étape du pipeline", OPP_CRITIQUE.stage],
      ["Commercial", OPP_CRITIQUE.com || "non renseigné"],
      [
        "Pourquoi c’est à risque",
        OPP_CRITIQUE.age
          ? `Ancienneté de ${OPP_CRITIQUE.age} — bien au-delà du cycle de vente réel moyen (79 jours) : la probabilité déclarée est probablement optimiste.`
          : "Plus grosse contribution pondérée du forecast — à sécuriser en priorité.",
      ],
      [
        "Action recommandée",
        OPP_CRITIQUE.risk
          ? "Requalifier ou clôturer cette opportunité pour fiabiliser le forecast."
          : "Suivre activement vers la signature.",
      ],
    ],
  },
  faitFournisseur: {
    title: `Détail — Exposition fournisseur : ${FOURN_CRITIQUE.name}`,
    items: [
      ["Montant commandé (12 derniers mois)", `${FOURN_CRITIQUE.expo12m} M FCFA — la plus forte exposition du portefeuille fournisseurs`],
      ["Commandes sur la période", `${FOURN_CRITIQUE.cmd12m} bons de commande`],
      ["Pourquoi c’est critique", "Le reste à payer fournisseurs global s'élève à 18,27 Md FCFA (849 dossiers). Dans un contexte de trésorerie tendue (10,86 Md FCFA d'impayés clients), un retard de paiement envers ce fournisseur clé mettrait en danger l'approvisionnement de la majorité des projets en cours."],
      ["Limite de données", "La dette exacte par fournisseur n'est pas ventilée dans les données actuelles — l'exposition affichée est le montant commandé sur 12 mois, meilleur indicateur réel disponible."],
      ["Action recommandée", `Vérifier dans Odoo l'encours réel de paiement envers ${FOURN_CRITIQUE.name} et sécuriser en priorité cette relation d'approvisionnement.`],
    ],
  },
};

function deltaTxt(cur: number, prev: number, suffix: string): { txt: string; variant: DeltaVariant } {
  if (prev <= 0) return { txt: suffix, variant: "none" };
  const pct = ((cur - prev) / prev) * 100;
  return {
    txt: `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1).replace(".", ",")} % ${suffix}`,
    variant: pct >= 0 ? "up" : "down",
  };
}

export function DashboardLive({
  kpis,
  bySalesperson,
}: {
  kpis: DashboardKpis;
  bySalesperson: SalespersonRevenue[];
}) {
  const [period, setPeriod] = useState<PeriodKey>("trimestre");
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [projLoading, setProjLoading] = useState(false);
  const [projShown, setProjShown] = useState(false);

  const y = kpis.year.year;
  const caByMonth = useMemo(() => {
    const map = new Array(12).fill(0);
    kpis.monthly.forEach((m) => (map[m.mois - 1] = m.ca_xof));
    return map;
  }, [kpis.monthly]);
  const caByMonthPrev = useMemo(() => {
    const map = new Array(12).fill(0);
    kpis.monthly_previous.forEach((m) => (map[m.mois - 1] = m.ca_xof));
    return map;
  }, [kpis.monthly_previous]);

  const lastMonthIdx = kpis.monthly.length
    ? Math.max(...kpis.monthly.map((m) => m.mois)) - 1
    : new Date().getMonth();
  const quarter = Math.floor(lastMonthIdx / 3); // trimestre du dernier mois de données
  const quarterMonths = [quarter * 3, quarter * 3 + 1, quarter * 3 + 2].filter((i) => i <= lastMonthIdx);

  // ---- KPI CA + graphe selon la période (calcul client-side, comme le mockup) ----
  const periodCalc = useMemo(() => {
    if (period === "mois") {
      const cur = caByMonth[lastMonthIdx];
      const prev = caByMonthPrev[lastMonthIdx];
      const chartMonths = [lastMonthIdx - 3, lastMonthIdx - 2, lastMonthIdx - 1, lastMonthIdx].filter((i) => i >= 0);
      return {
        caLabel: `CA commandé (${MONTH_FULL[lastMonthIdx]} ${y})`,
        ca: fmtM(cur),
        caDelta: deltaTxt(cur, prev, `vs ${MONTH_FULL[lastMonthIdx]} ${y - 1}`),
        months: chartMonths.map((i) => MONTH_LABELS[i]),
        realise: chartMonths.map((i) => Math.round(caByMonth[i] / 1_000_000)),
      };
    }
    if (period === "trimestre") {
      const cur = sum(quarterMonths.map((i) => caByMonth[i]));
      const prev = sum(quarterMonths.map((i) => caByMonthPrev[i]));
      return {
        caLabel: `CA commandé (T${quarter + 1} ${y})`,
        ca: fmtM(cur),
        caDelta: deltaTxt(cur, prev, `vs T${quarter + 1} ${y - 1}`),
        months: quarterMonths.map((i) => MONTH_LABELS[i]),
        realise: quarterMonths.map((i) => Math.round(caByMonth[i] / 1_000_000)),
      };
    }
    const allMonths = Array.from({ length: lastMonthIdx + 1 }, (_, i) => i);
    const cur = kpis.year.revenue_xof;
    const prevComparable = sum(allMonths.map((i) => caByMonthPrev[i]));
    return {
      caLabel: `CA commandé (${y}, jan-${MONTH_LABELS[lastMonthIdx].toLowerCase()})`,
      ca: fmtM(cur),
      caDelta: deltaTxt(cur, prevComparable, `vs jan-${MONTH_LABELS[lastMonthIdx].toLowerCase()} ${y - 1}`),
      months: allMonths.map((i) => MONTH_LABELS[i]),
      realise: allMonths.map((i) => Math.round(caByMonth[i] / 1_000_000)),
    };
  }, [period, caByMonth, caByMonthPrev, lastMonthIdx, quarter, quarterMonths, y, kpis.year.revenue_xof]);

  // ---- Jauge CA : CA de la période sélectionnée ----
  const caGauge = {
    label: periodCalc.caLabel,
    value: periodCalc.ca,
    delta: periodCalc.caDelta.txt,
    variant: periodCalc.caDelta.variant,
  };

  // ---- Rythme vs N-1 (comparable YTD) ----
  const ytdMonths = Array.from({ length: lastMonthIdx + 1 }, (_, i) => i);
  const ytdPrev = sum(ytdMonths.map((i) => caByMonthPrev[i]));
  const rythme = deltaTxt(kpis.year.revenue_xof, ytdPrev, "");

  // ---- Drill-down par gauge : détails réels (mêmes emplacements que le mockup) ----
  // Calcul direct (léger) — le React Compiler mémoïse lui-même.
  const details: Record<string, { title: string; items: [string, string][] }> = (() => {
    const withData = kpis.monthly.filter((m) => m.ca_xof > 0);
    const best = withData.length ? withData.reduce((a, b) => (b.ca_xof > a.ca_xof ? b : a)) : null;
    const worst = withData.length ? withData.reduce((a, b) => (b.ca_xof < a.ca_xof ? b : a)) : null;
    const panier = kpis.year.orders_count ? kpis.year.revenue_xof / kpis.year.orders_count : 0;
    const evolCmd = kpis.previous_year.orders_count
      ? ((kpis.year.orders_count - kpis.previous_year.orders_count) / kpis.previous_year.orders_count) * 100
      : 0;
    const p = kpis.open_pipeline;
    const biggestStage = p.par_stade.length
      ? p.par_stade.reduce((a, b) => (b.ca_brut_xof > a.ca_brut_xof ? b : a))
      : null;
    const busiestStage = p.par_stade.length
      ? p.par_stade.reduce((a, b) => (b.nb > a.nb ? b : a))
      : null;
    const w = kpis.win_rate;
    const m = kpis.marges;
    return {
      ...VIGILANCE_DETAILS,
      ca: {
        title: "Détail — CA commandé",
        items: [
          [`CA ${y}`, fmtM(kpis.year.revenue_xof)],
          [`CA ${y - 1} (année complète)`, fmtM(kpis.previous_year.revenue_xof)],
          [`Meilleur mois ${y}`, best ? `${MONTH_FULL[best.mois - 1]} — ${fmtM(best.ca_xof)}` : "—"],
          [`Plus faible mois ${y}`, worst ? `${MONTH_FULL[worst.mois - 1]} — ${fmtM(worst.ca_xof)}` : "—"],
          [`Nb commandes ${y}`, fmtInt(kpis.year.orders_count)],
          ["Panier moyen", fmtM(panier)],
          [`Nb commandes ${y - 1}`, fmtInt(kpis.previous_year.orders_count)],
          ["Évolution nb commandes", `${evolCmd >= 0 ? "+" : ""}${evolCmd.toFixed(1).replace(".", ",")} %`],
        ],
      },
      objectif: {
        title: `Détail — Rythme vs ${y - 1}`,
        items: [
          [`CA ${y} (YTD)`, fmtM(kpis.year.revenue_xof)],
          [`CA ${y - 1} (même période)`, fmtM(ytdPrev)],
          ["Écart", fmtM(kpis.year.revenue_xof - ytdPrev)],
          [`CA ${y - 1} (année complète)`, fmtM(kpis.previous_year.revenue_xof)],
          ["Meilleur contributeur", bySalesperson[0] ? `${bySalesperson[0].commercial} — ${fmtM(bySalesperson[0].ca_total_xof)}` : "—"],
          [`Clients actifs ${y}`, fmtInt(kpis.year.clients_with_orders)],
          [`Clients actifs ${y - 1}`, fmtInt(kpis.previous_year.clients_with_orders)],
          ["Plus faible mois", worst ? `${MONTH_FULL[worst.mois - 1]} — ${fmtM(worst.ca_xof)}` : "—"],
        ],
      },
      marge: {
        title: "Détail — Marge commerciale",
        items: [
          ["Marge définitive moyenne", fmtPct(m.perc_marge_definitive_moyen)],
          ["Nb dossiers en base", fmtInt(m.nb_dossiers)],
          ["CA définitif total", fmtM(m.ca_definitif_total)],
          ["Marge définitive cumulée", fmtM(m.marge_definitive_total)],
          ["Reste à encaisser", fmtM(m.reste_a_encaisser)],
          ["Backlog non facturé", fmtM(m.backlog_total)],
          ["Fournisseurs restant à payer", fmtM(m.fournisseurs_restant)],
          ["Source", "table dossiers (Odoo)"],
        ],
      },
      pipeline: {
        title: "Détail — Pipeline ouvert",
        items: [
          ["Valeur totale", fmtM(p.ca_brut_xof)],
          ["Nb opportunités", fmtInt(p.total_opportunites)],
          ["Valeur pondérée (proba)", fmtM(p.ca_pondere_xof)],
          ["Opportunités > 1 an", `${fmtInt(p.plus_un_an_nb)} (${p.plus_un_an_pct} %)`],
          ["Étape la plus chargée", busiestStage ? `${busiestStage.stade} — ${fmtInt(busiestStage.nb)} opp.` : "—"],
          ["Étape la plus valorisée", biggestStage ? `${biggestStage.stade} — ${fmtM(biggestStage.ca_brut_xof)}` : "—"],
          ["Ratio pondéré / brut", p.ca_brut_xof ? `${Math.round((p.ca_pondere_xof / p.ca_brut_xof) * 100)} %` : "—"],
          ["Source", "table opportunities (stades ouverts)"],
        ],
      },
      transfo: {
        title: "Détail — Taux de transformation",
        items: [
          ["Opportunités gagnées (historique)", fmtInt(w.gagnees_nb)],
          ["Opportunités perdues (historique)", fmtInt(w.perdues_nb)],
          ["Taux de victoire (nb)", fmtPct(w.taux_nb_pct)],
          ["Valeur gagnée", fmtM(w.gagnees_valeur_xof)],
          ["Valeur perdue", fmtM(w.perdues_valeur_xof)],
          ["Taux de victoire (valeur)", fmtPct(w.taux_valeur_pct)],
          ["Meilleur commercial (CA)", bySalesperson[0]?.commercial ?? "—"],
          ["Constat", "les dossiers perdus sont en moyenne plus gros que les gagnés"],
        ],
      },
    };
  })();

  // ---- Ligne de statut des filtres (mockup) ----
  const statusParts: string[] = [];
  if (period !== "trimestre") statusParts.push(`période : ${PERIODS.find((p) => p.key === period)!.label}`);

  function resetFilters() {
    setPeriod("trimestre");
  }

  const detail = openDetail ? details[openDetail] : null;
  const p = kpis.open_pipeline;

  const projection = {
    realiste: p.ca_pondere_xof,
    pessimiste: p.ca_pondere_xof * 0.8,
    optimiste: p.ca_pondere_xof * 1.2,
  };
  const ecart = kpis.year.revenue_xof - ytdPrev;

  function genererProjection() {
    setProjLoading(true);
    setProjShown(false);
    setTimeout(() => {
      setProjLoading(false);
      setProjShown(true);
    }, 700);
  }

  const gauges: { key: string; topColor: string; label: string; value: string; delta: string; variant: DeltaVariant }[] = [
    { key: "ca", topColor: "var(--color-good)", ...caGauge },
    {
      key: "objectif",
      topColor: "var(--color-ai)",
      label: `Rythme vs ${y - 1}`,
      value: rythme.txt.split(" %")[0] + " %",
      delta: `${y - 1} même période : ${fmtM(ytdPrev)}`,
      variant: "flag",
    },
    {
      key: "marge",
      topColor: "var(--color-good)",
      label: "Marge commerciale",
      value: fmtPct(kpis.marges.perc_marge_definitive_moyen),
      delta: `moyenne définitive (${fmtInt(kpis.marges.nb_dossiers)} dossiers)`,
      variant: "up",
    },
    {
      key: "pipeline",
      topColor: "var(--color-ai)",
      label: "Pipeline ouvert",
      value: fmtM(p.ca_brut_xof),
      delta: `${fmtInt(p.total_opportunites)} opportunités`,
      variant: "none",
    },
    {
      key: "transfo",
      topColor: "var(--color-bad)",
      label: "Taux de transformation",
      value: fmtPct(kpis.win_rate.taux_nb_pct),
      delta: `${fmtPct(kpis.win_rate.taux_valeur_pct)} en valeur`,
      variant: "down",
    },
  ];

  const vigilance: { key: string; color: string; label: string; value: string; valueSize: string; delta: string }[] = [
    {
      key: "faitImpaye",
      color: "var(--color-bad)",
      label: "⚠ Impayé le plus critique",
      value: IMPAYE_CRITIQUE.client,
      valueSize: "16px",
      delta: `${IMPAYE_CRITIQUE.montant} M FCFA — ${IMPAYE_CRITIQUE.jours} jours de retard`,
    },
    {
      key: "faitOpportunite",
      color: "var(--color-warn)",
      label: "⚠ Opportunité la plus à risque",
      value: OPP_CRITIQUE.name,
      valueSize: "15px",
      delta: `${OPP_CRITIQUE.client} — ${OPP_CRITIQUE.val} M FCFA${OPP_CRITIQUE.risk ? " (obsolète)" : ""}`,
    },
    {
      key: "faitFournisseur",
      color: "var(--color-bad)",
      label: "⚠ Exposition fournisseur la plus forte",
      value: FOURN_CRITIQUE.name,
      valueSize: "16px",
      delta: `${FOURN_CRITIQUE.expo12m} M FCFA commandés sur 12 mois`,
    },
  ];

  return (
    <>
      {/* ===== HEADER (structure mockup) ===== */}
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
          <div className="flex gap-1 rounded-[10px] border border-line bg-panel p-1">
            {PERIODS.map((pp) => (
              <button
                key={pp.key}
                onClick={() => setPeriod(pp.key)}
                className={clsx(
                  "cursor-pointer rounded-[7px] px-3 py-[7px] font-mono text-xs",
                  period === pp.key ? "bg-ai text-white" : "text-muted",
                )}
              >
                {pp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== INSTRUMENTS : 5 gauges du mockup, cliquables ===== */}
      <div className="mb-[22px] grid grid-cols-2 gap-3.5 xl:grid-cols-5">
        {gauges.map((g) => (
          <button
            key={g.key}
            onClick={() => setOpenDetail((cur) => (cur === g.key ? null : g.key))}
            className="group relative cursor-pointer overflow-hidden rounded-card border border-line bg-panel px-4 pb-3.5 pt-4 text-left transition hover:-translate-y-px hover:border-[#39466B]"
          >
            <span className="absolute left-0 top-0 h-0.5 w-full opacity-70" style={{ background: g.topColor }} />
            <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-muted">{g.label}</div>
            <div className="font-mono text-[22px] font-semibold tracking-[-0.01em]">{g.value}</div>
            <div className={clsx("mt-1.5 font-mono text-xs", DELTA_CLASS[g.variant])}>{g.delta}</div>
            <div className="absolute bottom-2.5 right-3 font-mono text-[9.5px] text-[#3A4668]">détail ↓</div>
          </button>
        ))}
      </div>

      {statusParts.length > 0 && (
        <div className="-mt-2.5 mb-[18px] font-mono text-[10px] text-muted">
          Filtres actifs — {statusParts.join(" · ")}{" "}
          <button onClick={resetFilters} className="cursor-pointer text-ai underline">
            réinitialiser
          </button>
        </div>
      )}

      {/* ===== DÉTAIL DRILL-DOWN (structure mockup, valeurs réelles) ===== */}
      {detail && (
        <div className="mb-[22px] rounded-card border border-ai bg-panel px-5 py-[18px]">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm">{detail.title}</h3>
            <button onClick={() => setOpenDetail(null)} className="cursor-pointer text-[13px] text-muted">
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

      {/* ===== CHART CA + POINTS DE VIGILANCE (grid2 mockup) ===== */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Évolution du CA — réalisé">
            <AiChip>Données réelles Odoo (commandes)</AiChip>
          </PanelHead>
          <CaChart
            period={{
              caLabel: "",
              ca: "",
              caDelta: "",
              objectif: "",
              objectifDelta: "",
              marge: "",
              margeDelta: "",
              pipeline: "",
              pipelineDelta: "",
              transfo: "",
              transfoDelta: "",
              months: periodCalc.months,
              realise: periodCalc.realise,
              prevision: periodCalc.months.map(() => null),
            }}
          />
        </Panel>
        <Panel>
          <PanelHead title="Points de vigilance" />
          <div className="flex flex-col gap-3">
            {vigilance.map((v) => (
              <button
                key={v.key}
                onClick={() => setOpenDetail((cur) => (cur === v.key ? null : v.key))}
                className="group relative cursor-pointer overflow-hidden rounded-card border border-line bg-panel-2 px-4 pb-3.5 pt-4 text-left transition hover:-translate-y-px hover:border-[#39466B]"
              >
                <span className="absolute left-0 top-0 h-0.5 w-full opacity-70" style={{ background: v.color }} />
                <div className="mb-1.5 text-[11.5px] uppercase tracking-[0.06em] text-muted">{v.label}</div>
                <div className="font-semibold leading-tight text-text" style={{ fontSize: v.valueSize }}>
                  {v.value}
                </div>
                <div className="mt-1 font-mono text-xs text-bad">{v.delta}</div>
                <div className="absolute bottom-2.5 right-3 font-mono text-[9.5px] text-[#3A4668]">détail ↓</div>
              </button>
            ))}
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

        {!projLoading && !projShown && (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Générer une projection » pour une projection chiffrée de la
            trajectoire à venir, avec une recommandation concrète associée — basée sur le
            pipeline pondéré réel.
          </div>
        )}

        {!projLoading && projShown && (
          <div className="rounded-card bg-panel-2 p-4">
            <div className="mt-0">
              <h4 className="mb-2 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
                Projection
              </h4>
              <p className="text-[13px] leading-relaxed text-text">
                Sur la base du pipeline pondéré réel, le CA des prochains mois est estimé
                entre <b>{fmtM(projection.pessimiste)}</b> (scénario prudent) et{" "}
                <b>{fmtM(projection.optimiste)}</b> (scénario optimiste), avec un scénario
                réaliste autour de <b>{fmtM(projection.realiste)}</b>. Cette estimation
                reste incertaine : elle dépend de la conversion effective des opportunités
                en cours
                {ecart !== 0 && (
                  <>
                    , et le CA {y} est {ecart >= 0 ? "en avance de" : "en retrait de"}{" "}
                    <b>{fmtM(Math.abs(ecart))}</b> par rapport à {y - 1} sur la même
                    période
                  </>
                )}
                .
              </p>
            </div>
            <div className="mt-4">
              <h4 className="mb-2 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
                Recommandation
              </h4>
              <p className="text-[12px] leading-relaxed text-muted">
                Concentrer les efforts sur les opportunités les plus avancées du pipeline
                pour sécuriser le scénario prudent avant de viser le scénario optimiste,
                tout en surveillant le risque de trésorerie associé aux impayés échus.
              </p>
            </div>
            <div className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
              Généré en mode simplifié (sans IA générative) — basé sur le pipeline pondéré
              réel ({fmtInt(p.total_opportunites)} opportunités).
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
