import { requireView } from "@/lib/session";
import { ForecastView } from "@/components/views/ForecastView";

export default async function ForecastPage() {
  await requireView("forecast");
  return <ForecastView />;
}
