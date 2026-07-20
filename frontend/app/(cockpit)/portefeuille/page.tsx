import { requireView } from "@/lib/session";
import { PortefeuilleView } from "@/components/views/PortefeuilleView";

export default async function PortefeuillePage() {
  await requireView("portefeuille");
  return <PortefeuilleView />;
}
