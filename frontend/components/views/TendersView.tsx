"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { TENDERS, TENDERS_CDC } from "@/lib/fixtures/tenders";
import type { CdcAnalysis, RiskLevel, VerdictStatut } from "@/lib/fixtures/tenders";

const URGENCY_CLASS: Record<string, string> = {
  urgent: "text-bad",
  soon: "text-warn",
  "": "text-muted",
};

const VERDICT: Record<VerdictStatut, { label: string; card: string; badge: string }> = {
  go: { label: "GO", card: "border-good/35 bg-good/10", badge: "bg-good text-text" },
  conditionnel: {
    label: "GO CONDITIONNEL",
    card: "border-warn/35 bg-warn/10",
    badge: "bg-warn text-text",
  },
  "no-go": { label: "NO-GO", card: "border-bad/35 bg-bad/10", badge: "bg-bad text-text" },
};

const RISK: Record<RiskLevel, { label: string; sev: string }> = {
  high: { label: "Risque élevé", sev: "bg-bad" },
  medium: { label: "Risque moyen", sev: "bg-warn" },
  low: { label: "Risque faible", sev: "bg-good" },
};

export function TendersView() {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [cdcIndex, setCdcIndex] = useState(0);
  const [cdcText, setCdcText] = useState(TENDERS_CDC[0].excerpt);
  const [analysis, setAnalysis] = useState<CdcAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  function selectCdc(i: number) {
    setCdcIndex(i);
    setCdcText(TENDERS_CDC[i].excerpt);
    setAnalysis(null);
  }

  function analyser() {
    setAnalyzing(true);
    setAnalysis(null);
    // Simulation du temps d'analyse (le mockup fait un setTimeout ; le vrai
    // appel LLM se branchera côté serveur dans une prochaine vague).
    setTimeout(() => {
      setAnalysis(TENDERS_CDC[cdcIndex]);
      setAnalyzing(false);
    }, 700);
  }

  return (
    <>
      <ViewHeader
        eyebrow="● appels d'offres"
        title="Appels d'offres"
        sub="5 identifiés dans le CRM · 1 seul avec échéance encore valide"
      />

      {/* liste des AO */}
      <div className="mb-4 rounded-card border border-line bg-panel p-5">
        <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_90px] gap-2.5 border-b border-line pb-2 text-[11px] uppercase tracking-[0.05em] text-muted">
          <div>Appel d&apos;offre</div>
          <div>Échéance</div>
          <div>Statut</div>
          <div>Avancement checklist</div>
          <div />
        </div>
        {TENDERS.map((t, i) => (
          <div key={i}>
            <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_90px] items-center gap-2.5 border-b border-line py-3 text-[12.5px]">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  {t.client} · {t.montant}
                </div>
              </div>
              <div className={clsx("font-mono", URGENCY_CLASS[t.urgency])}>{t.deadline}</div>
              <div>{t.status}</div>
              <div>
                <div className="relative h-1.5 rounded-[3px] bg-line">
                  <span
                    className="absolute left-0 top-0 h-full rounded-[3px] bg-good"
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => setOpenRow((cur) => (cur === i ? null : i))}
                  className="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-[7px] text-[11.5px] hover:border-ai"
                >
                  {openRow === i ? "Fermer" : "Ouvrir"}
                </button>
              </div>
            </div>
            {openRow === i && (
              <div className="pb-3.5 pt-1.5">
                <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-3.5 py-2.5">
                  <Badge variant={t.cdcReceived ? "open" : "risk"}>
                    {t.cdcReceived ? "CDC reçu" : "CDC non reçu"}
                  </Badge>
                  <span className="text-[11.5px] text-muted">
                    {t.cdcReceived
                      ? "Disponible dans l'analyse IA du CDC ci-dessous."
                      : "Aucun cahier des charges réel n'a été ingéré pour ce dossier (table kb_ao vide)."}
                  </span>
                </div>
                <div className="py-1 text-[11.5px] text-muted">
                  Commercial : {t.commercial}
                </div>
                {t.checklist.map((item, j) => (
                  <div key={j} className="py-1 text-[12px] text-muted">
                    • {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* analyse IA du CDC */}
      <Panel>
        <PanelHead title="Analyse IA du cahier des charges">
          <AiChip>extraction automatique</AiChip>
        </PanelHead>
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <select
            className="min-w-[260px] cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none"
            value={cdcIndex}
            onChange={(e) => selectCdc(Number(e.target.value))}
          >
            {TENDERS_CDC.map((t, i) => (
              <option key={i} value={i}>
                {t.name} — {t.client}
              </option>
            ))}
          </select>
          <button
            onClick={analyser}
            disabled={analyzing}
            className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
          >
            Analyser avec l&apos;IA
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-card border border-line bg-panel-2 p-5">
            <PanelHead title="Cahier des charges (extrait)" />
            <textarea
              value={cdcText}
              onChange={(e) => setCdcText(e.target.value)}
              className="min-h-[220px] w-full resize-y rounded-[10px] border border-line bg-ink p-3 text-[12.5px] leading-relaxed focus:border-ai focus:outline-none"
            />
          </div>
          <div className="rounded-card border border-line bg-panel-2 p-5">
            <PanelHead title="Résultat de l'analyse" />
            {analyzing ? (
              <AiChip>analyse en cours…</AiChip>
            ) : !analysis ? (
              <div className="text-[12.5px] text-muted">
                Sélectionnez un appel d&apos;offre puis cliquez sur « Analyser avec l&apos;IA ».
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-[12.5px]">
                <Section title={`Exigences extraites (${analysis.exigences.length})`}>
                  {analysis.exigences.map((e, i) => (
                    <div key={i} className="py-1">• {e}</div>
                  ))}
                </Section>
                <Section title="Critères de sélection">
                  {analysis.criteres.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span>{c.nom}</span>
                      <span className="flex items-center gap-2">
                        <span className="relative h-1.5 w-[90px] rounded-[3px] bg-line">
                          <span
                            className="absolute left-0 top-0 h-full rounded-[3px] bg-good"
                            style={{ width: `${c.poids}%` }}
                          />
                        </span>
                        <span className="font-mono text-[11.5px] text-ai">{c.poids}%</span>
                      </span>
                    </div>
                  ))}
                </Section>
                <Section title="Risques identifiés">
                  {analysis.risques.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <span className={clsx("mt-1 h-2 w-2 shrink-0 rounded-full", RISK[r.level].sev)} />
                      <span>
                        <b>{RISK[r.level].label}</b> — {r.text}
                      </span>
                    </div>
                  ))}
                </Section>
                <Section title="Documents manquants">
                  {analysis.documentsManquants.map((d, i) => (
                    <div key={i} className="py-1 text-warn">⚠ {d}</div>
                  ))}
                </Section>
                <div
                  className={clsx(
                    "rounded-xl border px-4 py-3.5",
                    VERDICT[analysis.recommandation.statut].card,
                  )}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span
                      className={clsx(
                        "rounded-lg px-3.5 py-1.5 font-display text-[14px] font-bold tracking-[0.03em]",
                        VERDICT[analysis.recommandation.statut].badge,
                      )}
                    >
                      {VERDICT[analysis.recommandation.statut].label}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      confiance IA · {analysis.recommandation.score}%
                    </span>
                  </div>
                  <div className="text-[12.5px] leading-relaxed">
                    {analysis.recommandation.synthese}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}
