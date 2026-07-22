import { requireView } from "@/lib/session";
import { fetchBriefing } from "@/lib/api/briefing";
import { BriefingLive } from "@/components/views/BriefingLive";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function BriefingPage() {
  await requireView("briefing");

  let data: Awaited<ReturnType<typeof fetchBriefing>> | null = null;
  let error: string | null = null;
  try {
    data = await fetchBriefing();
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (data === null) {
    return <ErrorState title="Briefing indisponible" error={error} />;
  }

  return <BriefingLive data={data} />;
}
