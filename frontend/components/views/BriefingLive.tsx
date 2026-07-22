"use client";

import { useTransition } from "react";
import { AiChip } from "@/components/ui/AiChip";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { refreshBriefingAction } from "@/app/actions";
import type { BriefingData } from "@/lib/api/briefing";

const ROLE_LABELS: Record<string, string> = {
  dg: "Direction Générale",
  dir_commercial: "Direction Commerciale",
  dir_financier: "Direction Financière",
  dir_operations: "Direction des Opérations",
  commercial: "Commercial",
};

const TRIGGERED_LABELS: Record<string, string> = {
  schedule: "généré automatiquement à minuit",
  manual: "relancé manuellement",
  cold_start: "généré au premier démarrage",
};

function formatDate(iso: string | null): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

export function BriefingLive({ data }: { data: BriefingData }) {
  const [refreshing, startRefresh] = useTransition();

  const section = data.section;
  const roleLabel = ROLE_LABELS[data.role] ?? data.role;
  const triggeredLabel = data.triggered_by ? TRIGGERED_LABELS[data.triggered_by] ?? data.triggered_by : null;

  function refresh() {
    startRefresh(async () => {
      await refreshBriefingAction();
    });
  }

  return (
    <>
      <ViewHeader
        eyebrow="● synthèse quotidienne"
        title="Briefing IA du jour"
        sub={`Pour ${roleLabel} — figé depuis le ${formatDate(data.generated_at)}${triggeredLabel ? ` (${triggeredLabel})` : ""}, jusqu'à minuit`}
      >
        <button
          onClick={refresh}
          disabled={refreshing}
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          ✺ Régénérer maintenant
        </button>
      </ViewHeader>

      {refreshing ? (
        <Panel>
          <AiChip>régénération en cours (les 5 profils)…</AiChip>
        </Panel>
      ) : section === null ? (
        <Panel>
          <div className="text-[12.5px] text-muted">
            Le briefing de votre profil n&apos;a pas pu être généré aujourd&apos;hui — réessayez avec
            « Régénérer maintenant ».
          </div>
        </Panel>
      ) : (
        <>
          <Panel className="mb-4 border-l-[3px] border-l-ai">
            <PanelHead title="Ce qui compte aujourd'hui">
              <AiChip>analyse</AiChip>
            </PanelHead>
            <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-text">
              {section.analysis.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Faits du jour">
              <AiChip>données réelles</AiChip>
            </PanelHead>
            <div className="flex flex-col gap-2">
              {section.bullets.map((b, i) => (
                <div key={i} className="rounded-lg border border-line border-l-2 border-l-ai bg-panel p-3 text-[12px] leading-relaxed">
                  {b}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
