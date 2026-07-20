"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { AO_FREQUENCIES, EXTRA_AO_POOL, VEILLE_AO } from "@/lib/fixtures/veille-ao";
import type { VeilleAO } from "@/lib/types";

function matchColor(score: number) {
  if (score >= 70) return "var(--color-good)";
  if (score >= 50) return "var(--color-warn)";
  return "var(--color-muted)";
}

function formatCountdown(sec: number) {
  if (sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function VeilleAoView() {
  const [list, setList] = useState<VeilleAO[]>(VEILLE_AO);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [frequency, setFrequency] = useState(AO_FREQUENCIES[1].value);
  const [countdown, setCountdown] = useState(AO_FREQUENCIES[1].value);
  const [lastRun, setLastRun] = useState("jamais");
  const [collecting, setCollecting] = useState(false);
  const poolRef = useRef([...EXTRA_AO_POOL]);

  const collect = useCallback(() => {
    setCollecting(true);
    setTimeout(() => {
      setList((prev) => {
        const cleared = prev.map((ao) => ({ ...ao, isNew: false }));
        const next = poolRef.current.shift();
        return next ? [...cleared, { ...next, isNew: true }] : cleared;
      });
      const now = new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastRun(`à l'instant (${now})`);
      setCountdown(frequency);
      setCollecting(false);
    }, 900);
  }, [frequency]);

  // Compte à rebours : décrémente chaque seconde, relance la collecte à 0.
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          collect();
          return frequency;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [collect, frequency]);

  function changeFrequency(v: number) {
    setFrequency(v);
    setCountdown(v);
  }

  function follow(id: string) {
    setFollowed((prev) => new Set(prev).add(id));
  }

  const sorted = [...list].sort((a, b) => b.match - a.match);

  return (
    <>
      <div className="mb-3.5 flex justify-end">
        <AiChip>{list.length} signaux réels (source : neurones.db, veille_entries)</AiChip>
      </div>

      <div className="rounded-card border border-line bg-panel p-5">
        <p className="mb-3.5 text-[11.5px] leading-relaxed text-muted">
          Surveillance automatique des plateformes (BOAMP, marchés publics, réseaux
          partenaires) — chaque appel d&apos;offre détecté est comparé au profil de Neurones
          Technologies.
        </p>

        <div className="mb-3.5 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-line bg-panel-2 px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-muted">Fréquence de collecte automatique</span>
            <select
              className="cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
              value={frequency}
              onChange={(e) => changeFrequency(Number(e.target.value))}
            >
              {AO_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={collect}
            disabled={collecting}
            className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
          >
            {collecting ? "Collecte en cours…" : "Lancer une collecte maintenant"}
          </button>
          <div className="min-w-[200px] flex-1 text-right font-mono text-[10px] text-muted">
            Dernière collecte : {lastRun} · prochaine collecte auto dans{" "}
            {formatCountdown(countdown)}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {sorted.map((ao) => {
            const isFollowed = followed.has(ao.id);
            return (
              <div
                key={ao.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-panel-2 px-4 py-3.5"
              >
                <div className="min-w-[240px] flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="warm">{ao.secteur}</Badge>
                    <span className="font-mono text-[10.5px] text-muted">{ao.source}</span>
                    {ao.isNew && <AiChip>nouveau</AiChip>}
                  </div>
                  <div className="text-[13.5px] font-semibold">{ao.name}</div>
                  <div className="mb-1.5 text-[11.5px] text-muted">{ao.organisme}</div>
                  <div className="text-[11.5px] leading-relaxed text-muted">↳ {ao.reason}</div>
                  <div className="mt-2 flex flex-wrap gap-3.5 font-mono text-[10.5px] text-muted">
                    <span className="flex items-center">
                      <span className="mr-1.5 inline-block h-[5px] w-[70px] rounded-[3px] bg-line align-middle">
                        <span
                          className="block h-full rounded-[3px]"
                          style={{ width: `${ao.match}%`, background: matchColor(ao.match) }}
                        />
                      </span>
                      correspondance IA : {ao.match}%
                    </span>
                    <span>montant : {ao.montant}</span>
                    <span>échéance : {ao.deadline}</span>
                  </div>
                </div>
                <button
                  onClick={() => follow(ao.id)}
                  disabled={isFollowed}
                  className={clsx(
                    "rounded-lg px-3 py-[7px] text-[11.5px] font-semibold",
                    isFollowed
                      ? "cursor-default border border-line bg-panel-2 text-muted"
                      : "cursor-pointer bg-ai text-white",
                  )}
                >
                  {isFollowed ? "Suivi ✓" : "Suivre cet AO"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
