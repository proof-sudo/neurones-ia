"use client";

import { clsx } from "clsx";

/** Carte « fait marquant » — même rendu que les gauges KPI, valeur en 16px. */
export function FaitCard({
  topColor,
  label,
  value,
  delta,
  deltaClass,
  onClick,
}: {
  topColor: string;
  label: string;
  value: string;
  delta: string;
  deltaClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-card border border-line bg-panel px-4 pb-3.5 pt-4 text-left transition hover:-translate-y-px hover:border-[#39466B]"
    >
      <span
        className="absolute left-0 top-0 h-0.5 w-full opacity-70"
        style={{ background: topColor }}
      />
      <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="font-mono text-[16px] font-semibold tracking-[-0.01em]">{value}</div>
      <div className={clsx("mt-1.5 font-mono text-xs", deltaClass)}>{delta}</div>
      <div className="absolute bottom-2.5 right-3 font-mono text-[9.5px] text-[#3A4668]">
        détail ↓
      </div>
    </button>
  );
}
