"use client";

import { useState } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ContextNote } from "@/components/ui/ViewHeader";
import { CLIENT_PROFILES } from "@/lib/fixtures/clients";
import type { ClientProfile } from "@/lib/types";

export function ClientsView() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ClientProfile | null>(null);

  const filtered = CLIENT_PROFILES.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <ContextNote>
        📎 <b>Donnée de contexte</b> — ce portefeuille alimente le Forecast, la Veille
        Client et les Suggestions d&apos;actions. Pour l&apos;état détaillé et à jour, voir
        Odoo.
      </ContextNote>

      <div className="mb-3 flex justify-end">
        <input
          className="min-w-[200px] cursor-text rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
          placeholder="Rechercher un client…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-[13px] text-muted">Aucun client ne correspond à la recherche.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          {filtered.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelected(c)}
              className="rounded-card border border-line bg-panel p-[18px] text-left transition hover:-translate-y-px hover:border-[#39466B]"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px]">{c.name}</h3>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {c.since} · {c.secteur}
                  </div>
                </div>
                <Badge variant="open">actif</Badge>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2.5">
                <Stat k="CA cumulé" v={c.ca} />
                <Stat k="Dossiers" v={c.dossiers} />
                <Stat k="Backlog" v={c.backlog} />
              </div>
              <MetaRow k="Contact" v={c.contact} />
              <MetaRow k="Reste à encaisser" v={c.resteEncaisser} />
              <MetaRow k="Dernier projet" v={c.dernierProjet} />
              <div className="mt-2.5 text-right">
                <AiChip>voir le profil &amp; recommandations IA</AiChip>
              </div>
            </button>
          ))}
        </div>
      )}

      <ClientModal client={selected} onClose={() => setSelected(null)} />
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

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-t border-line py-1.5 text-[12px] text-muted">
      <span>{k}</span>
      <b className="font-medium text-text">{v}</b>
    </div>
  );
}

export function ClientModal({
  client,
  onClose,
}: {
  client: ClientProfile | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!client} onClose={onClose} className="max-w-[760px] px-7 pb-7 pt-6">
      {client && (
        <>
          <div className="mb-1.5 flex items-start justify-between">
            <div>
              <div className="mb-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
                ● profil client — {client.secteur}
              </div>
              <h2 className="text-[19px]">{client.name}</h2>
              <div className="mt-1 text-[12px] text-muted">
                {client.since} · CA cumulé {client.ca} · Backlog {client.backlog}
              </div>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-muted hover:border-ai hover:text-text"
            >
              Fermer ✕
            </button>
          </div>

          <Section title="Activité">
            <p className="text-[13px] leading-relaxed text-text">{client.activite}</p>
          </Section>

          <Section title="Historique des projets & contrats (échantillon réel)">
            {client.historique.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-line py-2.5 text-[12.5px] last:border-none"
              >
                <div>
                  <div className="font-medium">{h.titre}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted">{h.periode}</div>
                </div>
                <Badge variant="cold">{h.statut}</Badge>
              </div>
            ))}
            <div className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
              Tous les dossiers de ce client sont au statut « draft » — signal probable
              d&apos;un processus de clôture à fiabiliser côté Odoo.
            </div>
          </Section>

          <Section
            title={
              <span className="flex items-center gap-1.5">
                <AiChip>recommandé par l&apos;IA</AiChip>
                Constats &amp; pistes d&apos;action
              </span>
            }
          >
            {client.recommandations.map((r, i) => (
              <div
                key={i}
                className="mb-2 rounded-lg border border-l-2 border-line border-l-ai bg-panel-2 px-3.5 py-3"
              >
                <div className="text-[13px] font-semibold">{r.service}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-muted">{r.rationale}</div>
              </div>
            ))}
          </Section>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              disabled
              title="Vue Génération d'offres — vague ultérieure"
              className="cursor-not-allowed rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white opacity-50"
            >
              Créer une offre pour ce client
            </button>
            <button
              disabled
              title="Copilote IA — backend à brancher"
              className="cursor-not-allowed rounded-lg border border-line bg-panel-2 px-3 py-[7px] text-[11.5px] text-text opacity-50"
            >
              🎯 Préparer le speech commercial (IA)
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h4 className="mb-2.5 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}
