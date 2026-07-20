import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { firstAllowedFrom } from "@/lib/navigation";
import { PROFILES } from "@/lib/fixtures/profiles";
import { AuthScreen } from "@/components/auth/AuthScreen";

export default async function ProfileScreen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(`/${firstAllowedFrom(session.allowedViews)}`);
  const { error } = await searchParams;

  return <AuthScreen profiles={PROFILES} serverError={error} />;
}
