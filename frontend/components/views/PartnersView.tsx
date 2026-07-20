"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/Badge";
import { ContextNote } from "@/components/ui/ViewHeader";
import { DetailPanel, DetailGrid, DetailItem } from "@/components/ui/DetailPanel";
import {
  PARTNERS,
  PARTNER_TYPES,
  CERTIFICATIONS_FOURNISSEURS,
  niveauPartenariat,
  risqueDependance,
  type Certification,
} from "@/lib/fixtures/partners";

const INPUT_CLASS =
  "rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

/** Badge d'état d'une certification (couleur selon statut / échéance). */
function certBadge(c: Certification): { label: string; color: string } {
  if (c.statut === "Validée") return { label: "Validée", color: "var(--color-good)" };
  if (c.statut === "À vérifier") return { label: "À vérifier", color: "var(--color-muted)" };
  if (c.echeance) {
    const joursAvant = Math.round((new Date(c.echeance).getTime() - Date.now()) / 86_400_000);
    return {
      label: `À renouveler — ${joursAvant} j`,
      color: joursAvant < 60 ? "var(--color-bad)" : "var(--color-warn)",
    };
  }
  return { label: "À renouveler", color: "var(--color-warn)" };
}

export function PartnersView() {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const query = q.trim().toLowerCase();
  const filtered = PARTNERS.filter((p) => {
    if (type && p.type !== type) return false;
    if (query && !(p.name.toLowerCase().includes(query) || p.specialite.toLowerCase().includes(query)))
      return false;
    return true;
  });

  const sel = PARTNERS.find((p) => p.name === selected) ?? null;

  return (
    <>
      <ContextNote>
        📎 <b>Donnée de contexte</b> — cet écosystème fournisseurs éclaire les Coûts &amp;
        marges et le Workflow. Pour l&apos;état détaillé et à jour, voir Odoo.
      </ContextNote>

      <div className="mb-3 text-[12.5px] text-muted">
        Fournisseurs réels (purchase_orders). Le « niveau de partenariat » et le « risque de
        dépendance » sont calculés par règle (montant total, part du total commandé), pas des
        données natives d&apos;Odoo.
      </div>

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <select
          className={clsx(INPUT_CLASS, "cursor-pointer")}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Tous les types</option>
          {PARTNER_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          className={clsx(INPUT_CLASS, "min-w-[220px] flex-1")}
          placeholder="Rechercher un fournisseur…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <DetailPanel
        open={!!sel}
        title={sel ? `${sel.name} — ${sel.specialite}` : ""}
        onClose={() => setSelected(null)}
      >
        {sel && <FournisseurDetail name={sel.name} />}
      </DetailPanel>

      {filtered.length === 0 ? (
        <div className="text-[13px] text-muted">Aucun fournisseur ne correspond.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          {filtered.map((p) => {
            const niveau = niveauPartenariat(p.caGenere);
            const risque = risqueDependance(p.caGenere);
            const isOpen = selected === p.name;
            return (
              <button
                key={p.name}
                onClick={() => setSelected((cur) => (cur === p.name ? null : p.name))}
                className={clsx(
                  "cursor-pointer rounded-card border bg-panel p-[18px] text-left transition-colors hover:border-ai",
                  isOpen ? "border-ai" : "border-line",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
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
                  <Stat k="Niveau" v={niveau.label} color={niveau.color} />
                </div>
                <div className="flex justify-between border-t border-line py-1.5 text-[12px] text-muted">
                  <span>Risque de dépendance</span>
                  <b className="font-medium" style={{ color: risque.color }}>
                    {risque.label} ({risque.part.toFixed(1)}%)
                  </b>
                </div>
                <div className="flex justify-between border-t border-line py-1.5 text-[12px] text-muted">
                  <span>Contact</span>
                  <b className="font-medium text-text">{p.contact}</b>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function FournisseurDetail({ name }: { name: string }) {
  const p = PARTNERS.find((x) => x.name === name)!;
  const niveau = niveauPartenariat(p.caGenere);
  const risque = risqueDependance(p.caGenere);
  const certs = CERTIFICATIONS_FOURNISSEURS[p.name] ?? [];

  return (
    <>
      <DetailGrid className="lg:grid-cols-4">
        <DetailItem k="Type" valueClassName="text-sm">
          {p.type}
        </DetailItem>
        <DetailItem k="Montant total réel">{p.caGenere} M FCFA</DetailItem>
        <DetailItem k="Niveau de partenariat" valueClassName="text-sm">
          <span style={{ color: niveau.color }}>{niveau.label}</span>
        </DetailItem>
        <DetailItem k="Risque de dépendance" valueClassName="text-sm">
          <span style={{ color: risque.color }}>{risque.label}</span>{" "}
          <span className="text-[11px] font-normal text-muted">({risque.part.toFixed(1)}%)</span>
        </DetailItem>
      </DetailGrid>

      <div className="mt-5">
        <h4 className="mb-2.5 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
          Certifications — suivi Marketing
        </h4>
        {certs.length === 0 ? (
          <div className="text-[12px] leading-relaxed text-muted">
            Aucune certification suivie pour ce fournisseur pour l&apos;instant.
          </div>
        ) : (
          <>
            {certs.map((c, i) => {
              const b = certBadge(c);
              return (
                <div key={i} className="flex items-center justify-between border-b border-line py-2.5 last:border-none">
                  <div>
                    <div className="text-[12.5px] font-medium">{c.nom}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted">
                      {c.echeance ? `Échéance : ${c.echeance}` : "Échéance non communiquée"}
                    </div>
                  </div>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white"
                    style={{ backgroundColor: b.color }}
                  >
                    {b.label}
                  </span>
                </div>
              );
            })}
            <div className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
              Exemple illustratif — aucune donnée réelle de certification fournisseur n&apos;existe
              dans <code>neurones.db</code>. Le suivi réel doit être communiqué par le service
              Marketing.
            </div>
          </>
        )}
      </div>

      <div className="mt-4 font-mono text-[10px] leading-relaxed text-muted">
        Aucune donnée de facture fournisseur ni d&apos;échéance de paiement séparée n&apos;existe
        dans <code>neurones.db</code> — seules les commandes (bons de commande réels) sont
        disponibles.
      </div>
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
