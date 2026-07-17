"use client";

import { Fragment, useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { ContextNote } from "@/components/ui/ViewHeader";
import { LEADS, QUAL_LABEL } from "@/lib/fixtures/leads";
import type { Qualification } from "@/lib/types";

const SELECT_CLASS =
  "cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

export function LeadsView() {
  const [q, setQ] = useState("");
  const [qual, setQual] = useState<"" | Qualification>("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const query = q.toLowerCase();
  const filtered = LEADS.map((l, i) => ({ l, i })).filter(
    ({ l }) =>
      (!query ||
        l.ent.toLowerCase().includes(query) ||
        l.ville.toLowerCase().includes(query) ||
        l.com.toLowerCase().includes(query)) &&
      (!qual || l.qual === qual),
  );

  return (
    <>
      <ContextNote>
        📎 <b>Donnée de contexte</b> — ces leads alimentent la Veille Client et les
        Suggestions d&apos;actions. Pour l&apos;état détaillé et à jour du CRM, voir Odoo.
      </ContextNote>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[13px] text-muted">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AiChip>données réelles — stade &quot;New&quot; (2026)</AiChip>
          <select
            className={SELECT_CLASS}
            value={qual}
            onChange={(e) => setQual(e.target.value as "" | Qualification)}
          >
            <option value="">Toutes qualifications</option>
            <option value="hot">Chaud</option>
            <option value="warm">Tiède</option>
            <option value="cold">Froid</option>
          </select>
          <input
            className={clsx(SELECT_CLASS, "min-w-[180px]")}
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-card border border-line bg-panel p-5">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Entreprise", "Ville", "Téléphone", "Valeur estimée", "Qualification", "Commercial"].map(
                (h) => (
                  <th
                    key={h}
                    className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-center text-muted">
                  Aucun prospect ne correspond à la recherche.
                </td>
              </tr>
            )}
            {filtered.map(({ l, i }) => (
              <Fragment key={i}>
                <tr
                  onClick={() => setExpanded((cur) => (cur === i ? null : i))}
                  className="cursor-pointer border-b border-line hover:bg-panel-2"
                >
                  <td className="px-2 py-2.5 text-text">{l.ent}</td>
                  <td className="px-2 py-2.5">{l.ville}</td>
                  <td className="px-2 py-2.5 font-mono">{l.tel}</td>
                  <td className="px-2 py-2.5 font-mono">
                    {l.val > 0 ? `${l.val} M FCFA` : "à chiffrer"}
                  </td>
                  <td className="px-2 py-2.5">
                    <Badge variant={l.qual}>{QUAL_LABEL[l.qual]}</Badge>
                  </td>
                  <td className="px-2 py-2.5">{l.com}</td>
                </tr>
                {expanded === i && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <div className="my-1 rounded-lg bg-panel-2 px-3.5 py-3 text-muted">
                        <div className="mb-2.5 text-[12px] leading-relaxed">{l.notes}</div>
                        <button
                          disabled
                          title="Sera branché au copilote IA (backend) dans une prochaine vague"
                          className="cursor-not-allowed rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white opacity-50"
                        >
                          🎯 Préparer le speech prospect (IA)
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
