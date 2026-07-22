import { requireView } from "@/lib/session";
import { fetchTopSuppliers } from "@/lib/api/partners";
import { PartnersLive } from "@/components/views/PartnersLive";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function PartenairesPage() {
  await requireView("partenaires");

  let suppliers: Awaited<ReturnType<typeof fetchTopSuppliers>> | null = null;
  let error: string | null = null;
  try {
    suppliers = await fetchTopSuppliers();
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (suppliers === null) {
    return <ErrorState title="Fournisseurs indisponible" error={error} />;
  }

  return (
    <>
      <ViewHeader
        eyebrow="● référentiel commercial"
        title="Fournisseurs"
        sub="Portefeuille fournisseurs — données réelles"
      />
      <PartnersLive suppliers={suppliers} />
    </>
  );
}
