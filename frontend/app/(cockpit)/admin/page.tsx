import { requireView } from "@/lib/session";
import { fetchPermissions, fetchUsers, type BackendPermissions } from "@/lib/api/admin";
import { AdminView } from "@/components/views/AdminView";

export default async function AdminPage() {
  await requireView("admin");

  // Les deux appels en parallèle ; seuls les utilisateurs sont bloquants —
  // sans matrice backend, le panneau permissions passe en lecture seule.
  const [usersResult, permissionsResult] = await Promise.allSettled([
    fetchUsers(),
    fetchPermissions(),
  ]);

  const users = usersResult.status === "fulfilled" ? usersResult.value : null;
  const permissions: BackendPermissions | null =
    permissionsResult.status === "fulfilled" ? permissionsResult.value : null;
  const loadError =
    usersResult.status === "rejected"
      ? usersResult.reason instanceof Error
        ? usersResult.reason.message
        : "erreur inconnue"
      : null;

  if (users === null) {
    return (
      <div className="rounded-card border border-l-[3px] border-line border-l-bad bg-panel p-5">
        <h3 className="mb-2 text-[14.5px] font-semibold">
          Administration indisponible
        </h3>
        <p className="text-[12.5px] leading-relaxed text-text">
          Impossible de charger les utilisateurs depuis le backend
          {loadError ? ` (${loadError})` : ""}. Vérifiez que l&apos;API FastAPI est
          démarrée (port 8000) et que votre session n&apos;a pas expiré, puis rechargez
          la page.
        </p>
      </div>
    );
  }

  return <AdminView users={users} permissions={permissions} />;
}
