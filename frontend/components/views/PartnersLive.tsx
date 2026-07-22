"use client";

import { useMemo, useState, useTransition } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { fmtM, fmtInt } from "@/lib/format";
import { generatePartnersAnalysisAction } from "@/app/actions";
import type { Supplier } from "@/lib/api/partners";

function niveauPartenariat(montantTotalXof: number): { label: string; color: string } {
  const m = montantTotalXof / 1_000_000;
  if (m >= 500) return { label: "Gold", color: "var(--color-ai)" };
  if (m >= 100) return { label: "Silver", color: "var(--color-good)" };
  return { label: "Bronze", color: "var(--color-warn)" };
}

function risqueDependance(montantTotalXof: number, total: number): { label: string; color: string; part: number } {
  const part = total ? (montantTotalXof / total) * 100 : 0;
  if (part > 25) return { label: "Élevé", color: "var(--color-bad)", part };
  if (part > 10) return { label: "Modéré", color: "var(--color-warn)", part };
  return { label: "Faible", color: "var(--color-good)", part };
}

function joursDepuisCommande(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export function PartnersLive({ suppliers }: { suppliers: Supplier[] }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, startAnalyzing] = useTransition();
  const [selected, setSelected] = useState<Supplier | null>(null);

  const total = useMemo(() => suppliers.reduce((s, p) => s + p.montant_total_xof, 0), [suppliers]);

  function toggleSelected(s: Supplier) {
    setSelected((cur) => (cur?.name === s.name ? null : s));
  }

  function genererAnalyse() {
    setAnalysisError(null);
    startAnalyzing(async () => {
      const res = await generatePartnersAnalysisAction();
      if (res.ok) setAnalysis(res.analysis);
      else setAnalysisError(res.error);
    });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[11.5px] leading-relaxed text-muted">
          Fournisseurs réels (purchase_orders, synchronisés depuis Odoo). Le type, la spécialité et
          les certifications ne sont pas suivis dans les données actuelles — non affichés plutôt
          qu&apos;inventés.
        </p>
        <button
          onClick={genererAnalyse}
          disabled={analyzing}
          className="shrink-0 cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          🔮 Analyse IA fournisseurs
        </button>
      </div>

      <Panel className="mb-4 border-l-[3px] border-l-ai">
        <PanelHead title="Ce que l'IA voit dans les fournisseurs">
          <AiChip>analyse</AiChip>
        </PanelHead>
        {analyzing ? (
          <AiChip>analyse en cours…</AiChip>
        ) : analysisError ? (
          <div className="text-[12.5px] text-bad">Analyse indisponible : {analysisError}</div>
        ) : !analysis ? (
          <div className="text-[12.5px] text-muted">
            Cliquez sur « Analyse IA fournisseurs » pour une lecture de la concentration du risque
            fournisseur, basée sur les vraies commandes d&apos;achat.
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-text">
            {analysis.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </Panel>

      {selected && (() => {
        const niveau = niveauPartenariat(selected.montant_total_xof);
        const risque = risqueDependance(selected.montant_total_xof, total);
        const jours = joursDepuisCommande(selected.derniere_commande);
        const inactif = jours !== null && jours > 365;
        return (
          <div className="mb-4 rounded-card border border-line bg-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14.5px] font-semibold">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="cursor-pointer text-[13px] text-muted">
                Fermer ✕
              </button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat k="Montant total réel" v={fmtM(selected.montant_total_xof)} />
              <Stat k="Niveau de partenariat" v={niveau.label} color={niveau.color} />
              <Stat k="Risque de dépendance" v={`${risque.label} (${risque.part.toFixed(1)}%)`} color={risque.color} />
              <Stat
                k="Activité"
                v={jours === null ? "—" : inactif ? `Inactif ${jours} j` : `il y a ${jours} j`}
                color={jours === null ? undefined : inactif ? "var(--color-bad)" : "var(--color-good)"}
              />
            </div>
            <h4 className="mb-2 text-[12.5px] font-semibold text-text">Historique réel des commandes</h4>
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  {["Référence", "Montant", "Date"].map((h) => (
                    <th key={h} className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.commandes_recentes.map((c, i) => (
                  <tr key={i} className="border-b border-line last:border-none">
                    <td className="px-2 py-2.5 text-text">{c.ref}</td>
                    <td className="px-2 py-2.5 font-mono">{fmtM(c.montant_xof)}</td>
                    <td className="px-2 py-2.5 text-muted">{c.date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {suppliers.length === 0 ? (
        <div className="text-[13px] text-muted">Aucune commande fournisseur enregistrée.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          {suppliers.map((s) => {
            const niveau = niveauPartenariat(s.montant_total_xof);
            const risque = risqueDependance(s.montant_total_xof, total);
            const jours = joursDepuisCommande(s.derniere_commande);
            const inactif = jours !== null && jours > 365;
            return (
              <button
                key={s.name}
                onClick={() => toggleSelected(s)}
                className="rounded-card border border-line bg-panel p-[18px] text-left transition hover:-translate-y-px hover:border-[#39466B]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-[15px]">{s.name}</h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white"
                    style={{ backgroundColor: niveau.color }}
                  >
                    {niveau.label}
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2.5">
                  <Stat k="Montant total" v={fmtM(s.montant_total_xof)} />
                  <Stat k="Commandes" v={fmtInt(s.nb_commandes)} />
                  <Stat k="Dernière commande" v={s.derniere_commande ?? "—"} />
                </div>
                <div className="flex justify-between border-t border-line py-1.5 text-[12px] text-muted">
                  <span>Risque de dépendance</span>
                  <b style={{ color: risque.color }}>
                    {risque.label} ({risque.part.toFixed(1)}%)
                  </b>
                </div>
                <div className="flex justify-between py-1.5 text-[12px] text-muted">
                  <span>Activité</span>
                  <b style={{ color: jours === null ? undefined : inactif ? "var(--color-bad)" : "var(--color-good)" }}>
                    {jours === null ? "—" : inactif ? `Inactif depuis ${jours} j` : `il y a ${jours} j`}
                  </b>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted">{k}</div>
      <div className="mt-0.5 font-mono text-[14px]" style={color ? { color } : undefined}>
        {v}
      </div>
    </div>
  );
}
