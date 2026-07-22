import { requireView } from "@/lib/session";
import { fetchPerformanceSummary } from "@/lib/api/performance";
import { PerformanceLive } from "@/components/views/PerformanceLive";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function PerformancePage() {
  await requireView("performance");

  let data: Awaited<ReturnType<typeof fetchPerformanceSummary>> | null = null;
  let error: string | null = null;
  try {
    data = await fetchPerformanceSummary();
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (data === null) {
    return <ErrorState title="Performances indisponibles" error={error} />;
  }

  return <PerformanceLive data={data} />;
}
