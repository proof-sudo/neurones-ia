import { clsx } from "clsx";

export type DeltaVariant = "up" | "down" | "flag" | "none";

const DELTA_CLASS: Record<DeltaVariant, string> = {
  up: "text-good",
  down: "text-bad",
  flag: "text-warn",
  none: "text-muted",
};

export interface KpiGaugeData {
  label: string;
  value: string;
  delta: string;
  color: string;
  deltaVariant?: DeltaVariant;
  /** Réduit la taille de la valeur (texte long) */
  small?: boolean;
}

export function KpiGauge({ label, value, delta, color, deltaVariant = "none", small }: KpiGaugeData) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-panel px-4 pb-3.5 pt-4">
      <span className="absolute left-0 top-0 h-0.5 w-full opacity-70" style={{ background: color }} />
      <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={clsx("font-mono font-semibold tracking-[-0.01em]", small ? "text-[13px]" : "text-[22px]")}>
        {value}
      </div>
      <div className={clsx("mt-1.5 font-mono text-xs", DELTA_CLASS[deltaVariant])}>{delta}</div>
    </div>
  );
}

export function KpiGaugeRow({ items }: { items: KpiGaugeData[] }) {
  return (
    <div className="mb-[22px] grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      {items.map((it) => (
        <KpiGauge key={it.label} {...it} />
      ))}
    </div>
  );
}
