import { requireView } from "@/lib/session";
import { PipelineView } from "@/components/views/PipelineView";

export default async function PipelinePage() {
  await requireView("pipeline");
  return <PipelineView />;
}
