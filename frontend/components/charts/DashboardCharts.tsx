"use client";

import { Line, Doughnut, Bar } from "react-chartjs-2";
import { CHART_GRID as GRID } from "./register";
import type { PeriodData } from "@/lib/types";
import {
  COMMERCIAUX_CA,
  COMMERCIAUX_NAMES,
  SECTEUR_COLORS,
  SECTEUR_LABELS,
  SECTEUR_VALUES,
} from "@/lib/fixtures/dashboard";

const HEIGHT = "h-[220px]";

export function CaChart({ period }: { period: PeriodData }) {
  return (
    <div className={HEIGHT}>
      <Line
        data={{
          labels: period.months,
          datasets: [
            {
              label: "Commandé (M FCFA)",
              data: period.realise,
              borderColor: "#0EA37A",
              backgroundColor: "#0EA37A22",
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: "#0EA37A",
            },
            {
              label: "Prévision IA (M FCFA)",
              data: period.prevision,
              borderColor: "#FF6A00",
              borderDash: [5, 4],
              backgroundColor: "transparent",
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: "#FF6A00",
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 8, usePointStyle: true } },
          },
          scales: {
            x: { grid: { color: GRID } },
            y: { grid: { color: GRID }, ticks: { callback: (v) => v + "M" } },
          },
        }}
      />
    </div>
  );
}

export function SecteurChart({ secteur }: { secteur: string }) {
  const colors = SECTEUR_LABELS.map((s, i) =>
    !secteur ? SECTEUR_COLORS[i] : s === secteur ? SECTEUR_COLORS[i] : "#2A335250",
  );
  return (
    <div className={HEIGHT}>
      <Doughnut
        data={{
          labels: SECTEUR_LABELS,
          datasets: [
            {
              data: SECTEUR_VALUES,
              backgroundColor: colors,
              borderColor: "#F6F6F3",
              borderWidth: 2,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 8,
                usePointStyle: true,
                padding: 12,
                font: { family: "'Inter',sans-serif", size: 11 },
              },
            },
          },
        }}
      />
    </div>
  );
}

/** Doughnut pays — mêmes couleurs et options que le mockup, données réelles. */
export function CountryDoughnut({
  labels,
  values,
  selected,
}: {
  labels: string[];
  values: number[];
  selected: string;
}) {
  const colors = labels.map((l, i) => {
    const base = SECTEUR_COLORS[i % SECTEUR_COLORS.length];
    if (!selected) return base;
    return l === selected ? base : "#2A335250";
  });
  return (
    <div className={HEIGHT}>
      <Doughnut
        data={{
          labels,
          datasets: [
            { data: values, backgroundColor: colors, borderColor: "#F6F6F3", borderWidth: 2 },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 8,
                usePointStyle: true,
                padding: 12,
                font: { family: "'Inter',sans-serif", size: 11 },
              },
            },
          },
        }}
      />
    </div>
  );
}

/** Bar commerciaux — même rendu que le mockup, données réelles + highlight. */
export function CommerciauxChartLive({
  labels,
  values,
  selected,
}: {
  labels: string[];
  values: number[];
  selected: string;
}) {
  const colors = labels.map((n) =>
    !selected ? "#FF6A00" : n === selected ? "#FF6A00" : "#2A335290",
  );
  return (
    <div className={HEIGHT}>
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "CA (M FCFA)",
              data: values,
              backgroundColor: colors,
              borderRadius: 5,
              barThickness: 22,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: "'Inter',sans-serif", size: 10 } },
            },
            y: { grid: { color: GRID }, ticks: { callback: (v) => v + "M" } },
          },
        }}
      />
    </div>
  );
}

export function CommerciauxChart({ commercial }: { commercial: string }) {
  const colors = COMMERCIAUX_NAMES.map((n) =>
    !commercial ? "#FF6A00" : n === commercial ? "#FF6A00" : "#2A335290",
  );
  return (
    <div className={HEIGHT}>
      <Bar
        data={{
          labels: COMMERCIAUX_NAMES,
          datasets: [
            {
              label: "CA (M FCFA, 2025-2026)",
              data: COMMERCIAUX_CA,
              backgroundColor: colors,
              borderRadius: 5,
              barThickness: 22,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: "'Inter',sans-serif", size: 10 } },
            },
            y: { grid: { color: GRID }, ticks: { callback: (v) => v + "M" } },
          },
        }}
      />
    </div>
  );
}
