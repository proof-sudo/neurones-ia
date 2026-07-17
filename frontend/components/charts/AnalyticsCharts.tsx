"use client";

import { Line, Doughnut, Bar } from "react-chartjs-2";
import { CHART_GRID as GRID } from "./register";

const HEIGHT = "h-[220px]";
const STAGE_COLORS = ["#FF6A00", "#0EA37A", "#C77D00", "#8C6E54", "#6B6D75", "#D64545", "#4CE0B3"];

const legendBottom = {
  position: "bottom" as const,
  labels: { boxWidth: 8, usePointStyle: true, font: { family: "'Inter',sans-serif", size: 11 } },
};

/** Forecast : 3 scénarios par mois. */
export function ForecastLineChart({
  labels,
  optimiste,
  realiste,
  pessimiste,
}: {
  labels: string[];
  optimiste: number[];
  realiste: number[];
  pessimiste: number[];
}) {
  return (
    <div className={HEIGHT}>
      <Line
        data={{
          labels,
          datasets: [
            { label: "Optimiste", data: optimiste, borderColor: "#FF6A00", backgroundColor: "#FF6A0015", fill: false, tension: 0.35, pointRadius: 3, borderDash: [4, 3] },
            { label: "Réaliste", data: realiste, borderColor: "#0EA37A", backgroundColor: "#0EA37A22", fill: true, tension: 0.35, pointRadius: 3 },
            { label: "Pessimiste", data: pessimiste, borderColor: "#D64545", backgroundColor: "transparent", fill: false, tension: 0.35, pointRadius: 3, borderDash: [2, 2] },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: legendBottom },
          scales: {
            x: { grid: { color: GRID } },
            y: { grid: { color: GRID }, ticks: { callback: (v) => Math.round(Number(v)) + "M" } },
          },
        }}
      />
    </div>
  );
}

/** Doughnut par étape du pipeline. */
export function StageDoughnut({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className={HEIGHT}>
      <Doughnut
        data={{
          labels,
          datasets: [{ data: values, backgroundColor: STAGE_COLORS, borderColor: "#F6F6F3", borderWidth: 2 }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 8, usePointStyle: true, padding: 10, font: { family: "'Inter',sans-serif", size: 11 } },
            },
          },
        }}
      />
    </div>
  );
}

/** Barres verticales (forecast par commercial, marge prévisionnelle). */
export function VBarChart({
  labels,
  values,
  label,
  color = "#FF6A00",
  tickSuffix = "M",
}: {
  labels: string[];
  values: number[];
  label: string;
  color?: string;
  tickSuffix?: string;
}) {
  return (
    <div className={HEIGHT}>
      <Bar
        data={{ labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 5, barThickness: 22 }] }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: "'Inter',sans-serif", size: 10 } } },
            y: { grid: { color: GRID }, ticks: { callback: (v) => v + tickSuffix } },
          },
        }}
      />
    </div>
  );
}

/** Barres horizontales (pertes par commercial). */
export function HBarChart({
  labels,
  values,
  label,
  color = "#D64545",
}: {
  labels: string[];
  values: number[];
  label: string;
  color?: string;
}) {
  return (
    <div className={HEIGHT}>
      <Bar
        data={{ labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 5, barThickness: 20 }] }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: GRID } },
            y: { grid: { display: false }, ticks: { font: { family: "'Inter',sans-serif", size: 10.5 } } },
          },
        }}
      />
    </div>
  );
}

/** Ligne trésorerie cumulée. */
export function TresoLineChart({
  labels,
  values,
  label,
}: {
  labels: string[];
  values: number[];
  label: string;
}) {
  return (
    <div className={HEIGHT}>
      <Line
        data={{
          labels,
          datasets: [{ label, data: values, borderColor: "#0EA37A", backgroundColor: "#0EA37A22", fill: true, tension: 0.3, pointRadius: 3 }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: legendBottom },
          scales: {
            x: { grid: { color: GRID } },
            y: { grid: { color: GRID }, ticks: { callback: (v) => v + "M" } },
          },
        }}
      />
    </div>
  );
}
