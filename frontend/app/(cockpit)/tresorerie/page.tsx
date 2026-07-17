import { requireView } from "@/lib/session";
import { TresorerieView } from "@/components/views/TresorerieView";

export default async function TresoreriePage() {
  await requireView("tresorerie");
  return <TresorerieView />;
}
