import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile } from "@/lib/fixtures/profiles";
import { Sidebar } from "@/components/shell/Sidebar";
import { CopilotRail } from "@/components/shell/CopilotRail";

export default async function CockpitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const profile = getProfile(session.role)!;
  // Vues autorisées DYNAMIQUES (backend /v1/auth/me) — la sidebar reflète la
  // matrice éditée depuis l'écran Administration, sans reconnexion.
  const allowedViews = session.allowedViews;

  return (
    <div className="grid min-h-screen grid-cols-1 min-[980px]:grid-cols-[80px_1fr] min-[1300px]:grid-cols-[216px_1fr]">
      <Sidebar allowedViews={allowedViews} profile={profile} />
      <main className="min-w-0 px-7 pb-16 pt-[26px]">{children}</main>
      <CopilotRail role={session.role} />
    </div>
  );
}
