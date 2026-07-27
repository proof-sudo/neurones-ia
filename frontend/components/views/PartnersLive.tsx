"use client";

import { useMemo, useState, useTransition } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { Modal } from "@/components/ui/Modal";
import { fmtM, fmtInt, fmtPct } from "@/lib/format";
import { generatePartnersAnalysisAction } from "@/app/actions";
import type { Supplier, SupplierIntelligence } from "@/lib/api/partners";

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

function pctColor(pct: number, seuils: { warn: number; bad: number } = { warn: 60, bad: 85 }): string {
  if (pct >= seuils.bad) return "var(--color-bad)";
  if (pct >= seuils.warn) return "var(--color-warn)";
  return "var(--color-good)";
}

function ancienneteLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const jours = Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (jours < 30) return `${jours} j`;
  if (jours < 365) return `${Math.round(jours / 30)} mois`;
  return `${(jours / 365).toFixed(1)} ans`;
}

export function PartnersLive({ suppliers }: { suppliers: Supplier[] }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, startAnalyzing] = useTransition();
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [q, setQ] = useState("");

  const total = useMemo(() => suppliers.reduce((s, p) => s + p.montant_total_xof, 0), [suppliers]);
  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

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
          Fournisseurs réels (purchase_orders, synchronisés depuis Odoo), enrichis des indicateurs
          crédit/cash/marge/paiement/rupture. Le type, la spécialité et les certifications ne sont
          pas suivis dans les données actuelles — non affichés plutôt qu&apos;inventés.
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

      <div className="mb-3 flex justify-end">
        <input
          className="min-w-[200px] cursor-text rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
          placeholder="Rechercher un fournisseur…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-[13px] text-muted">
          {suppliers.length === 0
            ? "Aucune commande fournisseur enregistrée."
            : "Aucun fournisseur ne correspond à la recherche."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          {filtered.map((s) => {
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
                <SignauxIntelligence intelligence={s.intelligence} />
              </button>
            );
          })}
        </div>
      )}

      <SupplierModal supplier={selected} total={total} onClose={() => setSelected(null)} />
    </>
  );
}

function SupplierModal({
  supplier,
  total,
  onClose,
}: {
  supplier: Supplier | null;
  total: number;
  onClose: () => void;
}) {
  return (
    <Modal open={!!supplier} onClose={onClose} className="max-w-[760px] px-7 pb-7 pt-6">
      {supplier &&
        (() => {
          const niveau = niveauPartenariat(supplier.montant_total_xof);
          const risque = risqueDependance(supplier.montant_total_xof, total);
          const jours = joursDepuisCommande(supplier.derniere_commande);
          const inactif = jours !== null && jours > 365;
          return (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14.5px] font-semibold">{supplier.name}</h3>
                <button onClick={onClose} className="cursor-pointer text-[13px] text-muted">
                  Fermer ✕
                </button>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat k="Montant total réel" v={fmtM(supplier.montant_total_xof)} />
                <Stat k="Niveau de partenariat" v={niveau.label} color={niveau.color} />
                <Stat k="Risque de dépendance" v={`${risque.label} (${risque.part.toFixed(1)}%)`} color={risque.color} />
                <Stat
                  k="Activité"
                  v={jours === null ? "—" : inactif ? `Inactif ${jours} j` : `il y a ${jours} j`}
                  color={jours === null ? undefined : inactif ? "var(--color-bad)" : "var(--color-good)"}
                />
              </div>
              <h4 className="mb-2 text-[12.5px] font-semibold text-text">État de la relation</h4>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat k="Fournisseur depuis" v={ancienneteLabel(supplier.premiere_commande)} />
                <Stat k="Montant moyen / commande" v={fmtM(supplier.montant_moyen_xof)} />
                <Stat
                  k="Engagement actif (12 mois)"
                  v={`${fmtM(supplier.montant_engage_12m_xof)} · ${fmtInt(supplier.nb_commandes_12m)} cmd.`}
                />
              </div>

              <IntelligenceDetail intelligence={supplier.intelligence} />

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
                  {supplier.commandes_recentes.map((c, i) => (
                    <tr key={i} className="border-b border-line last:border-none">
                      <td className="px-2 py-2.5 text-text">{c.ref}</td>
                      <td className="px-2 py-2.5 font-mono">{fmtM(c.montant_xof)}</td>
                      <td className="px-2 py-2.5 text-muted">{c.date ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          );
        })()}
    </Modal>
  );
}

/** Bandeau compact sur la carte — juste les signaux qui appellent une décision,
 * pas les 5 indicateurs en entier (ça, c'est le rôle de la modale). */
function SignauxIntelligence({ intelligence }: { intelligence?: SupplierIntelligence | null }) {
  if (!intelligence) return null;
  const badges: { label: string; color: string }[] = [];

  if (intelligence.taux_consommation_credit_pct !== null) {
    badges.push({
      label: `Crédit ${intelligence.taux_consommation_credit_pct.toFixed(0)}%`,
      color: pctColor(intelligence.taux_consommation_credit_pct),
    });
  }
  if (intelligence.retard_moyen_jours !== null && intelligence.retard_moyen_jours > 0) {
    badges.push({
      label: `Retard réel ${intelligence.retard_moyen_jours.toFixed(0)} j`,
      color: intelligence.retard_moyen_jours > 15 ? "var(--color-bad)" : "var(--color-warn)",
    });
  }
  if (intelligence.dossiers_a_risque_fournisseur_unique > 0) {
    badges.push({
      label: `${intelligence.dossiers_a_risque_fournisseur_unique} dossier(s) à risque`,
      color: "var(--color-bad)",
    });
  }
  if (badges.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
      {badges.map((b) => (
        <span
          key={b.label}
          className="rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white"
          style={{ backgroundColor: b.color }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

/** Détail complet des 5 indicateurs différenciants, dans la modale fournisseur. */
function IntelligenceDetail({ intelligence }: { intelligence?: SupplierIntelligence | null }) {
  if (!intelligence) {
    return (
      <div className="mb-4 rounded-card border border-line bg-panel p-3 text-[12px] text-muted">
        Intelligence fournisseur indisponible pour l&apos;instant — la synchro Odoo (factures
        fournisseurs, fiche crédit) n&apos;a pas encore de données pour ce fournisseur.
      </div>
    );
  }
  const i = intelligence;
  const cashTotal = i.cash_30j_xof + i.cash_60j_xof + i.cash_90j_xof + i.cash_plus_90j_xof;

  return (
    <>
      <h4 className="mb-2 text-[12.5px] font-semibold text-text">
        Intelligence fournisseur <span className="font-normal text-muted">— au-delà d&apos;Odoo</span>
      </h4>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          k="Ligne de crédit"
          v={i.credit_limit_xof ? fmtM(i.credit_limit_xof) : "non configurée"}
        />
        <Stat
          k="Encours dû"
          v={fmtM(i.encours_du_xof)}
          color={i.taux_consommation_credit_pct !== null ? pctColor(i.taux_consommation_credit_pct) : undefined}
        />
        <Stat
          k="Taux de consommation"
          v={i.taux_consommation_credit_pct !== null ? fmtPct(i.taux_consommation_credit_pct) : "—"}
          color={i.taux_consommation_credit_pct !== null ? pctColor(i.taux_consommation_credit_pct) : undefined}
        />
        <Stat
          k="Délai négocié"
          v={i.payment_term_name ?? "—"}
        />
      </div>

      <h4 className="mb-2 text-[12.5px] font-semibold text-text">Cash prévisionnel (échéances réelles)</h4>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="≤ 30 j" v={fmtM(i.cash_30j_xof)} />
        <Stat k="31-60 j" v={fmtM(i.cash_60j_xof)} />
        <Stat k="61-90 j" v={fmtM(i.cash_90j_xof)} />
        <Stat k="> 90 j" v={fmtM(i.cash_plus_90j_xof)} />
      </div>
      {cashTotal === 0 && (
        <p className="mb-4 -mt-2 text-[11.5px] text-muted">Aucune facture fournisseur ouverte actuellement.</p>
      )}

      <h4 className="mb-2 text-[12.5px] font-semibold text-text">Marge, fiabilité &amp; risque</h4>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          k="Marge sous-traitance"
          v={i.nb_dossiers_lies > 0 ? `${fmtM(i.marge_sous_traitance_xof)} (${i.nb_dossiers_lies} dossier${i.nb_dossiers_lies > 1 ? "s" : ""})` : "aucun dossier lié"}
        />
        <Stat
          k="Retard réel constaté"
          v={i.retard_moyen_jours !== null ? `${i.retard_moyen_jours > 0 ? "+" : ""}${i.retard_moyen_jours.toFixed(0)} j` : "—"}
          color={i.retard_moyen_jours !== null && i.retard_moyen_jours > 0 ? "var(--color-warn)" : undefined}
        />
        <Stat
          k="Taux de dépendance (volume)"
          v={fmtPct(i.taux_dependance_pct)}
        />
        <Stat
          k="Risque de rupture"
          v={i.dossiers_a_risque_fournisseur_unique > 0
            ? `${i.dossiers_a_risque_fournisseur_unique} dossier(s) actif(s) à fournisseur unique`
            : "aucun dossier actif à risque identifié"}
          color={i.dossiers_a_risque_fournisseur_unique > 0 ? "var(--color-bad)" : "var(--color-good)"}
        />
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
