import { requireView } from "@/lib/session";
import { fetchUnpaidData } from "@/lib/api/tresorerie";
import { fetchPipelineForecast } from "@/lib/api/forecast";
import { TresorerieLive } from "@/components/views/TresorerieLive";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function TresoreriePage() {
  await requireView("tresorerie");

  let unpaid: Awaited<ReturnType<typeof fetchUnpaidData>> | null = null;
  let pipelineForecast: Awaited<ReturnType<typeof fetchPipelineForecast>> | null = null;
  let error: string | null = null;
  try {
    [unpaid, pipelineForecast] = await Promise.all([fetchUnpaidData(), fetchPipelineForecast()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (unpaid === null || pipelineForecast === null) {
    return <ErrorState title="Trésorerie indisponible" error={error} />;
  }

  return <TresorerieLive unpaid={unpaid} pipelineForecast={pipelineForecast} />;
}
