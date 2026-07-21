"use client";

import { clsx } from "clsx";

export interface TabItem<T extends string> {
  key: T;
  label: string;
  count?: number;
}

/** Port du `.qa-toggle` / `.qa-tab` du mockup — segmented control d'onglets. */
export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="mb-3.5 flex gap-1 rounded-[9px] border border-line bg-panel p-[3px]">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={clsx(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] px-2 py-[7px] text-[11px] transition",
              isActive ? "bg-ai text-white" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={clsx(
                  "rounded-[9px] px-1.5 py-px font-mono text-[9.5px]",
                  isActive ? "bg-white/20" : "bg-black/[0.16]",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
