import { requireView } from "@/lib/session";
import { VeilleTabsView } from "@/components/views/VeilleTabsView";

export default async function VeillePage() {
  await requireView("veille");
  return <VeilleTabsView />;
}
