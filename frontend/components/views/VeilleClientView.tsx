"use client";

import { useState } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { PROSPECTS_FALLBACK, VEILLE_CLIENT_SECTEURS } from "@/lib/fixtures/veille";
import type { ProspectSuggestion } from "@/lib/types";

export function VeilleClientView() {
  const [secteur, setSecteur] = useState("");
  const [results, setResults] = useState<ProspectSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  function suggerer() {
    setLoading(true);
    setResults(null);
    // Suggestions issues de la base de secours (le mockup tente d'abord un
    // appel LLM ; le vrai appel se branchera côté serveur ultérieurement).
    setTimeout(() => {
      const filtered = secteur
        ? PROSPECTS_FALLBACK.filter((p) => p.secteur === secteur)
        : PROSPECTS_FALLBACK;
      setResults(filtered.length ? filtered : PROSPECTS_FALLBACK);
      setLoading(false);
    }, 700);
  }

  return (
    <>
      <div className="mb-3.5 flex justify-end">
        <AiChip>suggestions IA, pas une recherche web en direct</AiChip>
      </div>

      <p className="mb-3.5 text-[11.5px] leading-relaxed text-muted">
        Cet outil n&apos;a pas d&apos;accès web en direct : les suggestions s&apos;appuient sur
        vos vrais clients qui réussissent (télécom, banques, secteur public en Côte
        d&apos;Ivoire/Burkina Faso) et votre catalogue pour proposer des types de cibles
        pertinentes — à valider par un commercial avant tout contact, pas des leads confirmés.
      </p>

      <div className="mb-4 rounded-card border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            className="min-w-[220px] cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
          >
            <option value="">Tous secteurs (large)</option>
            {VEILLE_CLIENT_SECTEURS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={suggerer}
            disabled={loading}
            className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
          >
            🔎 Suggérer de nouveaux prospects (IA)
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading && <AiChip>recherche en cours…</AiChip>}
        {!loading && results === null && (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Suggérer de nouveaux prospects » pour lancer une première recherche.
          </div>
        )}
        {!loading &&
          results?.map((p, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-l-2 border-line border-l-ai bg-panel-2 px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="text-[13px] font-semibold">{p.nom}</div>
                <Badge variant="warm">{p.secteur}</Badge>
              </div>
              <div className="text-[12px] leading-relaxed text-muted">{p.raison}</div>
              <div className="text-[12px] leading-relaxed text-ai">
                💡 Piste de projet : {p.projet}
              </div>
              <div>
                <button
                  disabled
                  title="Ajout aux Leads — nécessite le backend (persistance), vague ultérieure"
                  className="cursor-not-allowed rounded-lg border border-line bg-panel px-3 py-[7px] text-[11.5px] text-muted opacity-60"
                >
                  ➕ Ajouter aux Leads pour qualification
                </button>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
