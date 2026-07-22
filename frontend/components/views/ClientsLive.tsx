"use client";

import { useState, useTransition } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ContextNote } from "@/components/ui/ViewHeader";
import { fmtM } from "@/lib/format";
import {
  fetchClientDossiersAction,
  generateClientProfileAction,
  type ClientDossierRow,
  type ClientProfileResult,
} from "@/app/actions";
import type { ClientPortfolioItem } from "@/lib/api/clients";

export function ClientsLive({
  clients,
  initialSelected,
}: {
  clients: ClientPortfolioItem[];
  initialSelected?: string | null;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ClientPortfolioItem | null>(
    initialSelected ? clients.find((c) => c.client === initialSelected) ?? null : null,
  );
  const [dossiers, setDossiers] = useState<ClientDossierRow[] | null>(null);
  const [dossiersError, setDossiersError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ClientProfileResult | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const filtered = clients.filter((c) => c.client.toLowerCase().includes(q.toLowerCase()));

  function loadDetails(client: ClientPortfolioItem) {
    setDossiersError(null);
    setProfileError(null);
    startLoading(async () => {
      const [dossiersRes, profileRes] = await Promise.all([
        fetchClientDossiersAction(client.client),
        generateClientProfileAction(client.client),
      ]);
      if (dossiersRes.ok) setDossiers(dossiersRes.dossiers);
      else setDossiersError(dossiersRes.error);
      if (profileRes.ok) setProfile(profileRes.profile);
      else setProfileError(profileRes.error);
    });
  }

  function selectClient(c: ClientPortfolioItem) {
    setSelected(c);
    setDossiers(null);
    setProfile(null);
    loadDetails(c);
  }

  function closeModal() {
    setSelected(null);
  }

  return (
    <>
      <ContextNote>
        📎 <b>Donnée de contexte</b> — ce portefeuille alimente le Forecast, la Veille Client et
        les Suggestions d&apos;actions. Pour l&apos;état détaillé et à jour, voir Odoo.
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
              key={c.client}
              onClick={() => selectClient(c)}
              className="rounded-card border border-line bg-panel p-[18px] text-left transition hover:-translate-y-px hover:border-[#39466B]"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px]">{c.client}</h3>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {c.nb_dossiers} dossiers · {c.secteur ?? "secteur non renseigné"}
                  </div>
                </div>
                <Badge variant="open">actif</Badge>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2.5">
                <Stat k="CA cumulé" v={fmtM(c.ca_total_xof)} />
                <Stat k="Dossiers" v={String(c.nb_dossiers)} />
                <Stat k="Backlog" v={fmtM(c.backlog_xof)} />
              </div>
              <MetaRow k="Contact" v={c.contact_email || c.telephone || "non renseigné"} />
              <MetaRow k="Reste à encaisser" v={fmtM(c.reste_a_encaisser_xof)} />
              <MetaRow k="Dernier projet" v={c.dernier_projet || "non renseigné"} />
              <div className="mt-2.5 text-right">
                <AiChip>voir le profil &amp; recommandations IA</AiChip>
              </div>
            </button>
          ))}
        </div>
      )}

      <ClientModal
        client={selected}
        dossiers={dossiers}
        dossiersError={dossiersError}
        profile={profile}
        profileError={profileError}
        loading={loading}
        onClose={closeModal}
        onLoad={() => selected && loadDetails(selected)}
      />
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

function ClientModal({
  client,
  dossiers,
  dossiersError,
  profile,
  profileError,
  loading,
  onClose,
  onLoad,
}: {
  client: ClientPortfolioItem | null;
  dossiers: ClientDossierRow[] | null;
  dossiersError: string | null;
  profile: ClientProfileResult | null;
  profileError: string | null;
  loading: boolean;
  onClose: () => void;
  onLoad: () => void;
}) {
  const notLoadedYet = !loading && dossiers === null && profile === null && !dossiersError && !profileError;

  return (
    <Modal open={!!client} onClose={onClose} className="max-w-[760px] px-7 pb-7 pt-6">
      {client && (
        <>
          <div className="mb-1.5 flex items-start justify-between">
            <div>
              <div className="mb-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
                ● profil client — {client.secteur ?? "secteur non renseigné"}
              </div>
              <h2 className="text-[19px]">{client.client}</h2>
              <div className="mt-1 text-[12px] text-muted">
                {client.nb_dossiers} dossiers · CA cumulé {fmtM(client.ca_total_xof)} · Backlog{" "}
                {fmtM(client.backlog_xof)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-muted hover:border-ai hover:text-text"
            >
              Fermer ✕
            </button>
          </div>

          {notLoadedYet ? (
            <div className="mt-5">
              <button
                onClick={onLoad}
                className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white"
              >
                Charger le profil &amp; l&apos;historique
              </button>
            </div>
          ) : (
            <>
              <Section title="Activité">
                {loading ? (
                  <AiChip>chargement…</AiChip>
                ) : profileError ? (
                  <div className="text-[12.5px] text-bad">Profil indisponible : {profileError}</div>
                ) : (
                  <p className="text-[13px] leading-relaxed text-text">{profile?.activite}</p>
                )}
              </Section>

              <Section title="Historique des dossiers (réel)">
                {loading ? (
                  <AiChip>chargement…</AiChip>
                ) : dossiersError ? (
                  <div className="text-[12.5px] text-bad">Historique indisponible : {dossiersError}</div>
                ) : (
                  (dossiers ?? []).slice(0, 8).map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b border-line py-2.5 text-[12.5px] last:border-none"
                    >
                      <div>
                        <div className="font-medium">{d.projet || d.ref}</div>
                        <div className="mt-0.5 text-[11.5px] text-muted">
                          {d.date_creation ?? "date non renseignée"} · {d.commercial || "commercial non renseigné"}
                        </div>
                      </div>
                      <Badge variant="cold">{d.etat}</Badge>
                    </div>
                  ))
                )}
              </Section>

              <Section
                title={
                  <span className="flex items-center gap-1.5">
                    <AiChip>{profile?.ai_generated ? "rédigé par l'IA" : "règles sur données réelles"}</AiChip>
                    Constats &amp; pistes d&apos;action
                  </span>
                }
              >
                {loading ? (
                  <AiChip>chargement…</AiChip>
                ) : (
                  (profile?.recommandations ?? []).map((r, i) => (
                    <div
                      key={i}
                      className="mb-2 rounded-lg border border-l-2 border-line border-l-ai bg-panel-2 px-3.5 py-3"
                    >
                      <div className="text-[12px] leading-relaxed text-muted">{r}</div>
                    </div>
                  ))
                )}
              </Section>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-2.5 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}
