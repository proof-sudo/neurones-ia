"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AiChip } from "@/components/ui/AiChip";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { KANBAN_DATA, KANBAN_STAGES } from "@/lib/fixtures/pipeline";
import type { KanbanCard } from "@/lib/types";

export function PipelineView() {
  const [selected, setSelected] = useState<KanbanCard | null>(null);

  return (
    <>
      <ViewHeader
        eyebrow="● opportunités"
        title="Pipeline"
        sub="47 opportunités · 3,6 M€ en cours"
      >
        <AiChip>3 cartes marquées à risque</AiChip>
      </ViewHeader>

      <div className="grid grid-cols-2 gap-2.5 overflow-x-auto md:grid-cols-4 xl:grid-cols-7">
        {KANBAN_STAGES.map((stage) => {
          const cards = KANBAN_DATA[stage] ?? [];
          return (
            <div
              key={stage}
              className="min-w-[170px] rounded-[10px] border border-line bg-panel-2 p-2.5"
            >
              <div className="mb-2 flex justify-between text-[11px] uppercase tracking-[0.05em] text-muted">
                <span>{stage}</span>
                <span>{cards.length}</span>
              </div>
              {cards.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(c)}
                  className={clsx(
                    "mb-2 block w-full rounded-lg border border-line bg-panel p-2.5 text-left text-[11.5px] transition hover:border-ai",
                    c.risk && "border-l-2 border-l-bad",
                  )}
                >
                  <div className="mb-1 font-semibold">{c.name}</div>
                  <div className="mb-1.5 text-[11px] text-muted">{c.client}</div>
                  <div className="flex justify-between font-mono text-[10.5px]">
                    <span>{c.val}</span>
                    <span className="text-ai">{c.prob}%</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        className="max-w-[520px] px-7 pb-7 pt-6"
      >
        {selected && (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
                  ● opportunité
                </div>
                <h2 className="text-[19px]">{selected.name}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-muted hover:border-ai hover:text-text"
              >
                Fermer ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <Detail k="Client" v={selected.client} />
              <Detail k="Valeur" v={selected.val} />
              <Detail k="Probabilité" v={`${selected.prob} %`} />
              <Detail k="Commercial" v={selected.com} />
              <Detail k="Âge dans le CRM" v={selected.age} />
              <div>
                <div className="mb-1 text-[11px] text-muted">Statut</div>
                {selected.risk ? (
                  <Badge variant="risk">à risque — ancienne dans le CRM</Badge>
                ) : (
                  <Badge variant="open">en cours</Badge>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted">{k}</div>
      <div className="font-mono text-[15px]">{v}</div>
    </div>
  );
}
