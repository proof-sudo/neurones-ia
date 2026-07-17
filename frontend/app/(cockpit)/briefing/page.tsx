import { requireView } from "@/lib/session";
import { BriefingView } from "@/components/views/BriefingView";

export default async function BriefingPage() {
  await requireView("briefing");
  return <BriefingView />;
}
