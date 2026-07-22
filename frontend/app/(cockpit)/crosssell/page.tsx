import { requireView } from "@/lib/session";
import { fetchCrossSellSignals } from "@/lib/api/crosssell";
import { CrossSellLive } from "@/components/views/CrossSellLive";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function CrossSellPage() {
  await requireView("crosssell");

  let data: Awaited<ReturnType<typeof fetchCrossSellSignals>> | null = null;
  let error: string | null = null;
  try {
    data = await fetchCrossSellSignals();
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (data === null) {
    return <ErrorState title="Montée en valeur indisponible" error={error} />;
  }

  return <CrossSellLive data={data} />;
}
