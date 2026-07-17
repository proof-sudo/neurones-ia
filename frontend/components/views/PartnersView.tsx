"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ContextNote } from "@/components/ui/ViewHeader";
import { PARTNERS, PARTNER_TYPES } from "@/lib/fixtures/partners";

export function PartnersView() {
  const [type, setType] = useState("");
  const filtered = type ? PARTNERS.filter((p) => p.type === type) : PARTNERS;

  return (
    <>
      <ContextNote>
        📎 <b>Donnée de contexte</b> — cet écosystème fournisseurs éclaire les Coûts &amp;
        marges et le Workflow. Pour l&apos;état détaillé et à jour, voir Odoo.
      </ContextNote>

      <div className="mb-3 text-[12.5px] text-muted">
        Fournisseurs réels (purchase_orders) — pas de distinction
        éditeur/intégrateur/revendeur dans les données
      </div>

      <div className="mb-3.5">
        <select
          className="cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Tous les types</option>
          {PARTNER_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-[13px] text-muted">Aucun fournisseur pour ce type.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          {filtered.map((p) => (
            <div key={p.name} className="rounded-card border border-line bg-panel p-[18px]">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px]">{p.name}</h3>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {p.since} · {p.specialite}
                  </div>
                </div>
                <Badge variant={p.statut === "actif" ? "open" : "cold"}>{p.type}</Badge>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2.5">
                <Stat k="Commandes (2025-2026)" v={String(p.dealsApportes)} />
                <Stat k="Montant total" v={`${p.caGenere} M FCFA`} />
                <Stat k="Statut" v={p.statut} />
              </div>
              <div className="flex justify-between border-t border-line py-1.5 text-[12px] text-muted">
                <span>Contact</span>
                <b className="font-medium text-text">{p.contact}</b>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted">{k}</div>
      <div className="mt-0.5 font-mono text-[14px]">{v}</div>
    </div>
  );
}
