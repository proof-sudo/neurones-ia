import { requireView } from "@/lib/session";
import { fetchDashboardData } from "@/lib/api/dashboard";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { DashboardLive } from "@/components/dashboard/DashboardLive";
import { DemoBanner } from "@/components/ui/DemoBanner";

export default async function DashboardPage() {
  await requireView("dashboard");

  let data: Awaited<ReturnType<typeof fetchDashboardData>> | null = null;
  try {
    data = await fetchDashboardData();
  } catch {
    data = null; // backend tombé en cours de session (ou token expiré) → repli honnête
  }

  if (data === null) {
    return (
      <>
        <DemoBanner reason="error" />
        <DashboardView />
      </>
    );
  }

  return (
    <DashboardLive
      kpis={data.kpis}
      byCountry={data.byCountry}
      bySalesperson={data.bySalesperson}
      topClients={data.topClients}
    />
  );
}
