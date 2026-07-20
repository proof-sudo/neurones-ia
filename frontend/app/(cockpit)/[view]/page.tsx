import { notFound } from "next/navigation";
import { requireView } from "@/lib/session";
import { NAV_MODULES } from "@/lib/navigation";
import { ComingSoon } from "@/components/shell/ComingSoon";

const MODULE_BY_VIEW = new Map(NAV_MODULES.map((m) => [m.view, m]));

export default async function CockpitViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const navModule = MODULE_BY_VIEW.get(view);
  if (!navModule) notFound();

  await requireView(view);
  return <ComingSoon module={navModule} />;
}
