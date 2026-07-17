import { AiChip } from "@/components/ui/AiChip";
import { Panel } from "@/components/ui/Panel";
import type { NavModule } from "@/lib/types";

export function ComingSoon({ module }: { module: NavModule }) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
            ● module {module.view}
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">
            {module.icon} {module.label}
          </h1>
          <div className="mt-1 text-[13px] text-muted">
            Cette vue sera portée dans une prochaine vague de conversion.
          </div>
        </div>
        <AiChip>en cours de portage</AiChip>
      </div>
      <Panel>
        <p className="text-[13px] leading-relaxed text-muted">
          Le tableau de bord est la première vue livrée. Les autres modules
          (leads, clients, pipeline, forecast, trésorerie…) suivent le même kit
          de composants et seront branchés progressivement.
        </p>
      </Panel>
    </>
  );
}
