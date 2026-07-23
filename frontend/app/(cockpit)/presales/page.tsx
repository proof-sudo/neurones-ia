import { getSession, requireView } from "@/lib/session";
import { PresalesWorkflow } from "@/components/presales/PresalesWorkflow";

export default async function PresalesPage() {
  await requireView("presales");
  const session = await getSession();
  const userName = session?.fullName || session?.email || "";
  return <PresalesWorkflow currentUserName={userName} />;
}
