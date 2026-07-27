import { requireView } from "@/lib/session";
import { fetchTopSuppliers, fetchSupplierIntelligence } from "@/lib/api/partners";
import { PartnersLive } from "@/components/views/PartnersLive";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function PartenairesPage() {
  await requireView("partenaires");

  let suppliers: Awaited<ReturnType<typeof fetchTopSuppliers>> | null = null;
  let error: string | null = null;
  try {
    // Intelligence indisponible (ex. synchro Odoo pas encore passée) → dégrade sans
    // bloquer la page : les 5 nouveaux indicateurs restent vides, le reste s'affiche.
    const [top, intelligenceResult] = await Promise.all([
      fetchTopSuppliers(),
      fetchSupplierIntelligence().catch(() => []),
    ]);
    const intelligenceByName = new Map(intelligenceResult.map((s) => [s.name, s]));
    suppliers = top.map((s) => ({ ...s, intelligence: intelligenceByName.get(s.name) ?? null }));
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
