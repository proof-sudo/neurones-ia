import { requireView } from "@/lib/session";
import { fetchClientPortfolio } from "@/lib/api/clients";
import { fetchTopSuppliers } from "@/lib/api/partners";
import { PortefeuilleLive } from "@/components/views/PortefeuilleLive";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function PortefeuillePage() {
  await requireView("portefeuille");

  let clients: Awaited<ReturnType<typeof fetchClientPortfolio>> | null = null;
  let suppliers: Awaited<ReturnType<typeof fetchTopSuppliers>> | null = null;
  let error: string | null = null;
  try {
    [clients, suppliers] = await Promise.all([fetchClientPortfolio(), fetchTopSuppliers()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (clients === null || suppliers === null) {
    return <ErrorState title="Portefeuille indisponible" error={error} />;
  }

  return <PortefeuilleLive clients={clients} suppliers={suppliers} />;
}
