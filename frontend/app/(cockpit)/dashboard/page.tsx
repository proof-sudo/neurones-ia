import { requireView } from "@/lib/session";
import { fetchDashboardData } from "@/lib/api/dashboard";
import { DashboardLive } from "@/components/dashboard/DashboardLive";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function DashboardPage() {
  await requireView("dashboard");

  let data: Awaited<ReturnType<typeof fetchDashboardData>> | null = null;
  let error: string | null = null;
  try {
    data = await fetchDashboardData();
  } catch (e) {
    error = e instanceof Error ? e.message : "erreur inconnue";
  }

  if (data === null) {
    return <ErrorState title="Tableau de bord indisponible" error={error} />;
  }

  return (
    <DashboardLive
      kpis={data.kpis}
      bySalesperson={data.bySalesperson}
      unpaid={data.unpaid}
      pipelineForecast={data.pipelineForecast}
      suppliers={data.suppliers}
    />
  );
}
