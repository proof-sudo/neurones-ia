import { requireView } from "@/lib/session";
import { fetchPipelineForecast } from "@/lib/api/forecast";
import { ForecastLive } from "@/components/views/ForecastLive";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function ForecastPage() {
  await requireView("forecast");

  let data: Awaited<ReturnType<typeof fetchPipelineForecast>> | null = null;
  let error: string | null = null;
  try {
    data = await fetchPipelineForecast();
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (data === null) {
    return <ErrorState title="Forecast indisponible" error={error} />;
  }

  return <ForecastLive data={data} />;
}
