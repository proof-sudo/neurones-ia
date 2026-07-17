import { requireView } from "@/lib/session";
import { TendersView } from "@/components/views/TendersView";

export default async function TendersPage() {
  await requireView("tenders");
  return <TendersView />;
}
