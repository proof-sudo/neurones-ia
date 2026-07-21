"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/Badge";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { ContextNote } from "@/components/ui/ViewHeader";
import { DetailPanel, DetailItem } from "@/components/ui/DetailPanel";
import {
  PARTNERS,
  PARTNER_TYPES,
  CERTIFICATIONS_FOURNISSEURS,
  TOTAL_COMMANDE_FOURNISSEURS,
  niveauPartenariat,
  risqueDependance,
  joursDepuisCommande,
  type Certification,
} from "@/lib/fixtures/partners";

const INPUT_CLASS =
  "rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

/** Badge d'état d'une certification (couleur selon statut / échéance, par rapport à AUJOURDHUI). */
function certBadge(c: Certification): { label: string; color: string } {
  if (c.statut === "Validée") return { label: "Validée", color: "var(--color-good)" };
  if (c.statut === "À vérifier") return { label: "À vérifier", color: "var(--color-muted)" };
  if (c.echeance) {
    const joursAvant = joursDepuisCommande(c.echeance); // signé : négatif = échéance future
    const restant = -joursAvant;
    return {
      label: `À renouveler — ${restant} j`,
      color: restant < 60 ? "var(--color-bad)" : "var(--color-warn)",
    };
  }
  return { label: "À renouveler", color: "var(--color-warn)" };
}

export function PartnersView() {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const query = q.trim().toLowerCase();
  const filtered = PARTNERS.filter((p) => {
    if (type && p.type !== type) return false;
    if (query && !(p.name.toLowerCase().includes(query) || p.specialite.toLowerCase().includes(query)))
      return false;
    return true;
  });

  const sel = PARTNERS.find((p) => p.name === selected) ?? null;

  function genererAnalyse() {
    setAnalyzing(true);
    setAnalysis(false);
    setTimeout(() => {
      setAnalysis(true);
      setAnalyzing(false);
    }, 700);
  }

  // --- Données de l'analyse IA (calculées par règle, comme le repli du mockup v38) ---
  const top = [...PARTNERS].sort((a, b) => b.caGenere - a.caGenere)[0];
  const topShare = Math.round((top.caGenere / TOTAL_COMMANDE_FOURNISSEURS) * 100);
  const inactifs = PARTNERS.map((p) => ({ ...p, jours: joursDepuisCommande(p.derniereCommande) }))
    .filter((p) => p.jours > 365)
    .sort((a, b) => b.jours - a.jours);

  return (
    <>
      <ContextNote>
        📎 <b>Donnée de contexte</b> — cet écosystème fournisseurs éclaire les Coûts &amp;
        marges et le Workflow. Pour l&apos;état détaillé et à jour, voir Odoo.
      </ContextNote>

      <div className="mb-3 text-[12.5px] text-muted">
        Fournisseurs réels (purchase_orders). Le « niveau de partenariat » et le « risque de
        dépendance » sont calculés par règle (montant total, récence, part du total commandé), pas
        des données natives d&apos;Odoo.
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
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
        <button
          onClick={genererAnalyse}
          disabled={analyzing}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          🔮 Analyse IA fournisseurs
        </button>
      </div>

      {(analyzing || analysis) && (
        <Panel className="mb-4 border-l-[3px] border-l-ai">
          <PanelHead title="Ce que l'IA voit dans les fournisseurs">
            <AiChip>analyse</AiChip>
          </PanelHead>
          {analyzing ? (
            <AiChip>analyse en cours…</AiChip>
          ) : (
            <div className="flex flex-col gap-3 text-[12.5px] leading-relaxed text-text">
              <div>
                <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                  Risque de concentration
                </div>
                <p>
                  <b>{top.name}</b> représente à lui seul <b>{topShare}%</b> du montant total
                  commandé ({top.caGenere.toLocaleString("fr-FR")} M FCFA sur{" "}
                  {TOTAL_COMMANDE_FOURNISSEURS.toLocaleString("fr-FR")} M FCFA) — dépendance à
                  surveiller sur ce seul canal d&apos;approvisionnement.
                </p>
              </div>
              <div>
                <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                  Fournisseurs dormants
                </div>
                {inactifs.length === 0 ? (
                  <p>Aucun fournisseur inactif depuis plus d&apos;un an actuellement.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {inactifs.map((p) => (
                      <div key={p.name} className="flex items-start gap-2">
                        <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full bg-warn" />
                        <span>
                          {p.name} — aucune commande depuis <b>{p.jours} jours</b> (
                          {Math.round((p.jours / 365) * 10) / 10} an(s))
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                  Recommandation
                </div>
                <p>
                  {inactifs.length > 0
                    ? `Statuer sur la relation avec ${inactifs[0].name} (inactif depuis ${inactifs[0].jours} jours) : réactiver le contact ou considérer la relation comme terminée pour fiabiliser le référentiel fournisseurs.`
                    : `Diversifier progressivement les achats hors de ${top.name} pour réduire la dépendance à un canal unique.`}
                </p>
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-muted">
                Généré en mode simplifié — basé sur les vraies commandes fournisseurs
                (purchase_orders), lues côté client.
              </div>
            </div>
          )}
        </Panel>
      )}

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
            const jours = joursDepuisCommande(p.derniereCommande);
            const inactif = jours > 365;
            const niveau = niveauPartenariat(p);
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
                  <Stat k="Dernière commande" v={p.derniereCommande} small />
                </div>
                <MetaRow label="Niveau de partenariat">
                  <b className="font-medium" style={{ color: niveau.color }}>
                    {niveau.label}
                  </b>
                </MetaRow>
                <MetaRow label="Risque de dépendance">
                  <b className="font-medium" style={{ color: risque.color }}>
                    {risque.label} ({risque.part.toFixed(1)}%)
                  </b>
                </MetaRow>
                <MetaRow label="Activité">
                  <b
                    className="font-medium"
                    style={{ color: inactif ? "var(--color-bad)" : "var(--color-good)" }}
                  >
                    {inactif ? `Inactif depuis ${jours} jours` : `Actif — il y a ${jours} jours`}
                  </b>
                </MetaRow>
                <div className="mt-2.5 text-right">
                  <AiChip>voir l&apos;historique des commandes</AiChip>
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
  const jours = joursDepuisCommande(p.derniereCommande);
  const inactif = jours > 365;
  const niveau = niveauPartenariat(p);
  const risque = risqueDependance(p.caGenere);
  const certs = CERTIFICATIONS_FOURNISSEURS[p.name] ?? [];

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
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
        <DetailItem k="Activité" valueClassName="text-[13px]">
          <span style={{ color: inactif ? "var(--color-bad)" : "var(--color-good)" }}>
            {inactif ? `Inactif ${jours} j` : `il y a ${jours} j`}
          </span>
        </DetailItem>
      </div>

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
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-line py-2.5 last:border-none"
                >
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

      <div className="mt-5">
        <h4 className="mb-2.5 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
          Historique réel des commandes (purchase_orders)
        </h4>
        {p.commandes.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-line py-2.5 last:border-none"
          >
            <div>
              <div className="text-[12.5px] font-medium">{c.ref}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{c.date}</div>
            </div>
            <b className="font-mono text-[12.5px] text-ai">{c.montant} M FCFA</b>
          </div>
        ))}
      </div>

      <div className="mt-4 font-mono text-[10px] leading-relaxed text-muted">
        Aucune donnée de facture fournisseur ni d&apos;échéance de paiement séparée n&apos;existe
        dans <code>neurones.db</code> — seules les commandes (bons de commande réels) sont
        disponibles. Le « niveau de partenariat » et le « risque de dépendance » sont calculés par
        règle (montant total, récence, part du total commandé), pas une donnée native d&apos;Odoo.
      </div>
    </>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between border-t border-line py-1.5 text-[12px] text-muted">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Stat({ k, v, color, small }: { k: string; v: string; color?: string; small?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted">{k}</div>
      <div
        className={clsx("mt-0.5 font-mono", small ? "text-[12px]" : "text-[14px]")}
        style={color ? { color } : undefined}
      >
        {v}
      </div>
    </div>
  );
}
