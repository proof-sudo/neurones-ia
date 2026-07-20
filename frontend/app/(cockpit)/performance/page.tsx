import { requireView } from "@/lib/session";
import { PerformanceView } from "@/components/views/PerformanceView";

export default async function PerformancePage() {
  await requireView("performance");
  return <PerformanceView />;
}
