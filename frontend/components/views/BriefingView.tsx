"use client";

import { useState } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { BRIEFINGS } from "@/lib/fixtures/workflow";
import { ACTION_SUGGESTIONS } from "@/lib/fixtures/actions";

export function BriefingView() {
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const b = BRIEFINGS[0];
  const topActions = ACTION_SUGGESTIONS.slice(0, 3);

  function generer() {
    setLoading(true);
    setGenerated(false);
    // Le mockup tente un appel LLM puis retombe sur les données locales.
    // Ici : repli local (le vrai LLM se branchera sur /api/copilot serveur).
    setTimeout(() => {
      setGenerated(true);
      setLoading(false);
    }, 700);
  }

  return (
    <>
      <ViewHeader
        eyebrow="● synthèse cross-module"
        title="Briefing IA du jour"
        sub="Un récit quotidien qui relie trésorerie, deals/pipeline et fournisseurs"
      >
        <button
          onClick={generer}
          disabled={loading}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          ✺ Générer le briefing du jour
        </button>
      </ViewHeader>

      <p className="mb-4 text-[11.5px] leading-relaxed text-muted">
        Ce bloc génère 4 éléments : ce qui compte aujourd&apos;hui, 3 points clés à retenir,
        1 risque à surveiller, et 1 recommandation concrète pour la journée.
      </p>

      <div className="mb-4 rounded-card border border-line bg-panel p-5">
        <h3 className="mb-3.5 text-[14.5px] font-semibold">Signaux détectés</h3>
        <div className="flex flex-col gap-2.5">
          <div className="rounded-lg border border-line border-l-2 border-l-ai bg-panel p-3 text-[12px] leading-relaxed">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.06em] text-ai">
              ◆ opportunité à risque
            </span>
            L&apos;opportunité <b>« Refresh WAN — Orange Côte d&apos;Ivoire »</b> (3 673 M FCFA)
            est ouverte depuis plus de 7 ans en stade Qualification. Recommandation : la
            clôturer ou la requalifier.
          </div>
          <div className="rounded-lg border border-line border-l-2 border-l-ai bg-panel p-3 text-[12px] leading-relaxed">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.06em] text-ai">
              ◆ recouvrement
            </span>
            <b>BAD</b>{" "}
            concentre 1 682 M FCFA d&apos;impayés, dont 756 M FCFA en souffrance depuis 444
            jours — signalé en priorité haute dans le dernier briefing IA.
          </div>
          <div className="rounded-lg border border-line border-l-2 border-l-ai bg-panel p-3 text-[12px] leading-relaxed">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.06em] text-ai">
              ◆ audit interne
            </span>
            <b>Coris Holding Burkina Faso</b> affiche un backlog de 1 266 M FCFA pour
            seulement 331 M FCFA de CA commandé — écart à vérifier avant toute nouvelle
            offre.
          </div>
        </div>
      </div>

      {loading && <AiChip>synthèse en cours…</AiChip>}

      {!loading && !generated && (
        <div className="text-[12.5px] text-muted">
          Cliquez sur « Générer le briefing du jour » pour une synthèse à jour.
        </div>
      )}

      {!loading && generated && (
        <div className="rounded-card border border-l-[3px] border-line border-l-ai bg-panel p-5">
          <Section title="Ce qui compte aujourd'hui">
            <p className="text-[13px] leading-relaxed text-text">{b.idee}</p>
          </Section>

          <Section title="3 points clés">
            {topActions.map((a, i) => (
              <div key={i} className="py-1 text-[12.5px] text-text">
                • <b>{a.title}</b> — {a.desc}
              </div>
            ))}
          </Section>

          <Section title="1 risque à surveiller">
            <div className="flex items-start gap-2.5 py-1">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-bad" />
              <span className="text-[12.5px] leading-snug">{b.risques[0]}</span>
            </div>
          </Section>

          <Section title="Recommandation du jour">
            <div className="text-[12px] leading-relaxed text-muted">{b.actions[0]}</div>
          </Section>

          <div className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
            Généré à partir des vraies données déjà présentes dans l&apos;outil (briefings,
            suggestions d&apos;actions, alertes) — la rédaction dynamique par le LLM se
            branchera côté serveur dans une prochaine vague.
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h4 className="mb-2.5 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}
