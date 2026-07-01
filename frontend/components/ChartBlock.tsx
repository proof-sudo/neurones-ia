"use client";
import { useMemo } from "react";
import { BarChart3 } from "lucide-react";

/**
 * Rend un graphique à partir d'un bloc ```chart (JSON) émis par l'assistant.
 *
 * Schéma JSON attendu :
 *   {
 *     "type": "bar" | "line" | "pie" | "donut",
 *     "title"?: string,
 *     "unit"?: string,                       // ex: "M XOF", "%"
 *     "data": [ { "label": string, "value": number }, ... ]
 *   }
 *
 * 100 % autonome (SVG + CSS) — aucune dépendance externe.
 * Pendant le streaming le JSON est incomplet → on affiche un squelette discret.
 */

type ChartType = "bar" | "line" | "pie" | "donut";
interface ChartPoint { label: string; value: number }
interface ChartSpec {
  type: ChartType;
  title?: string;
  unit?: string;
  data: ChartPoint[];
}

const PALETTE = [
  "#0a2a43", "#f26a21", "#7c5cff", "#2bb673",
  "#e4b400", "#3b9ed6", "#d6336c", "#5c6b7a",
];

const fmtNumber = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);

const fmtValue = (n: number, unit?: string) =>
  unit ? `${fmtNumber(n)} ${unit}` : fmtNumber(n);

function parseSpec(raw: string): ChartSpec | null {
  try {
    const obj = JSON.parse(raw.trim());
    if (!obj || typeof obj !== "object") return null;
    const data = Array.isArray(obj.data)
      ? obj.data
          .filter((d: unknown): d is ChartPoint =>
            !!d && typeof d === "object" &&
            "label" in (d as object) && "value" in (d as object) &&
            Number.isFinite(Number((d as ChartPoint).value)))
          .map((d: ChartPoint) => ({ label: String(d.label), value: Number(d.value) }))
      : [];
    if (data.length === 0) return null;
    const type: ChartType = ["bar", "line", "pie", "donut"].includes(obj.type) ? obj.type : "bar";
    return {
      type,
      title: typeof obj.title === "string" ? obj.title : undefined,
      unit: typeof obj.unit === "string" ? obj.unit : undefined,
      data,
    };
  } catch {
    return null;
  }
}

function ChartFrame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-xl border border-slate-200 bg-white p-3.5">
      {title && (
        <div className="flex items-center gap-1.5 mb-3">
          <BarChart3 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <p className="text-xs font-semibold text-slate-700">{title}</p>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Bar (vertical, HTML/CSS — texte net & responsive) ─────────────────────── */
function BarChart({ spec }: { spec: ChartSpec }) {
  const max = Math.max(...spec.data.map((d) => d.value), 0) || 1;
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: 210 }}>
      {spec.data.map((d, i) => {
        const h = Math.max((Math.max(d.value, 0) / max) * 150, d.value > 0 ? 2 : 0);
        return (
          <div
            key={i}
            className="flex flex-col items-center justify-end h-full min-w-[36px] flex-1"
            title={`${d.label} : ${fmtValue(d.value, spec.unit)}`}
          >
            <span className="text-[10px] font-semibold text-slate-500 mb-1 whitespace-nowrap">
              {fmtNumber(d.value)}
            </span>
            <div
              className="w-full max-w-[56px] rounded-t-md transition-all"
              style={{ height: h, background: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-[10px] text-slate-500 mt-1.5 text-center leading-tight w-full break-words line-clamp-2">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Line (SVG) ────────────────────────────────────────────────────────────── */
function LineChart({ spec }: { spec: ChartSpec }) {
  const W = 600, H = 240, padL = 8, padR = 8, padT = 16, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...spec.data.map((d) => d.value), 0) || 1;
  const n = spec.data.length;
  const x = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (Math.max(v, 0) / max) * innerH;
  const pts = spec.data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const areaPts = `${padL},${padT + innerH} ${pts} ${padL + innerW},${padT + innerH}`;
  const accent = PALETTE[1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map((t) => {
        const gy = padT + innerH - t * innerH;
        return (
          <g key={t}>
            <line x1={padL} y1={gy} x2={padL + innerW} y2={gy} stroke="#eef1f5" strokeWidth={1} />
            <text x={padL} y={gy - 3} fontSize={10} fill="#94a3b8">{fmtNumber(max * t)}</text>
          </g>
        );
      })}
      <polygon points={areaPts} fill={accent} opacity={0.08} />
      <polyline points={pts} fill="none" stroke={accent} strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round" />
      {spec.data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r={3.5} fill="#fff" stroke={accent} strokeWidth={2} />
          <text x={x(i)} y={H - 10} fontSize={10} fill="#64748b" textAnchor="middle">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Pie / Donut (SVG + légende) ───────────────────────────────────────────── */
function PieChart({ spec }: { spec: ChartSpec }) {
  const total = spec.data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const R = 80, C = 100, inner = spec.type === "donut" ? 46 : 0;
  let angle = -Math.PI / 2;

  const arc = (frac: number) => {
    const start = angle;
    const end = angle + frac * 2 * Math.PI;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = C + R * Math.cos(start), y1 = C + R * Math.sin(start);
    const x2 = C + R * Math.cos(end), y2 = C + R * Math.sin(end);
    if (frac >= 0.999) {
      // cercle complet : deux demi-arcs (un seul path A ne ferme pas un cercle plein)
      return `M ${C - R} ${C} A ${R} ${R} 0 1 1 ${C + R} ${C} A ${R} ${R} 0 1 1 ${C - R} ${C} Z`;
    }
    if (inner > 0) {
      const xi1 = C + inner * Math.cos(end), yi1 = C + inner * Math.sin(end);
      const xi2 = C + inner * Math.cos(start), yi2 = C + inner * Math.sin(start);
      return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2} Z`;
    }
    return `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 200 200" className="w-40 h-40 shrink-0">
        {spec.data.map((d, i) => (
          <path key={i} d={arc(Math.max(d.value, 0) / total)}
            fill={PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="flex-1 w-full flex flex-col gap-1.5">
        {spec.data.map((d, i) => {
          const pct = (Math.max(d.value, 0) / total) * 100;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="flex-1 text-slate-600 truncate">{d.label}</span>
              <span className="font-semibold text-slate-700 whitespace-nowrap">
                {fmtValue(d.value, spec.unit)}
              </span>
              <span className="text-slate-400 whitespace-nowrap w-11 text-right">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChartBlock({ raw }: { raw: string }) {
  const spec = useMemo(() => parseSpec(raw), [raw]);

  if (!spec) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-400">
        <BarChart3 className="w-3.5 h-3.5 animate-pulse" />
        Préparation du graphique…
      </div>
    );
  }

  return (
    <ChartFrame title={spec.title}>
      {spec.type === "bar" && <BarChart spec={spec} />}
      {spec.type === "line" && <LineChart spec={spec} />}
      {(spec.type === "pie" || spec.type === "donut") && <PieChart spec={spec} />}
    </ChartFrame>
  );
}
