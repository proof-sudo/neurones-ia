import { requireView } from "@/lib/session";
import { PresalesWorkflow } from "@/components/presales/PresalesWorkflow";

export default async function PresalesPage() {
  await requireView("presales");
  return <PresalesWorkflow />;
}
