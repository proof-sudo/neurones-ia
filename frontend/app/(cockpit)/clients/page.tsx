import { requireView } from "@/lib/session";
import { fetchClientPortfolio } from "@/lib/api/clients";
import { ClientsLive } from "@/components/views/ClientsLive";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireView("clients");
  const { client } = await searchParams;

  let clients: Awaited<ReturnType<typeof fetchClientPortfolio>> | null = null;
  let error: string | null = null;
  try {
    clients = await fetchClientPortfolio();
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (clients === null) {
    return <ErrorState title="Clients indisponible" error={error} />;
  }

  return (
    <>
      <ViewHeader
        eyebrow="● référentiel commercial"
        title="Clients"
        sub="Portefeuille clients — données réelles"
      />
      <ClientsLive clients={clients} initialSelected={client ?? null} />
    </>
  );
}
