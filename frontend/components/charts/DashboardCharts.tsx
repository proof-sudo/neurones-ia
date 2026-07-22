"use client";

import { Line } from "react-chartjs-2";
import { CHART_GRID as GRID } from "./register";
import type { PeriodData } from "@/lib/types";

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
