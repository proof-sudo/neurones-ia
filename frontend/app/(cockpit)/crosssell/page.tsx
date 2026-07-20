import { requireView } from "@/lib/session";
import { CrossSellView } from "@/components/views/CrossSellView";

export default async function CrossSellPage() {
  await requireView("crosssell");
  return <CrossSellView />;
}
