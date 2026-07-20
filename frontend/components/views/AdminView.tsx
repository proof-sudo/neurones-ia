import { Panel, PanelHead } from "@/components/ui/Panel";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { MODULE_ACCESS } from "@/lib/navigation";
import { AdminPermissionsPanel } from "./AdminPermissionsPanel";
import { AdminUsersPanel, type UserRow } from "./AdminUsersPanel";
import type { BackendPermissions, BackendUser } from "@/lib/api/admin";

const SELECT_CLASS =
  "w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

export function AdminView({
  users,
  permissions,
}: {
  users: BackendUser[];
  /** null = endpoint permissions injoignable → matrice statique en lecture seule */
  permissions: BackendPermissions | null;
}) {
  // Comptes réels (table users de la base) — création/édition via l'API
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    nom: u.full_name,
    email: u.email,
    role: u.role,
    actif: u.is_active,
  }));

  return (
    <>
      <ViewHeader
        eyebrow="● back-office"
        title="Administration"
        sub="Utilisateurs, rôles, permissions, agences et paramètres régionaux"
      />


      {/* utilisateurs — CRUD réel quand le backend est joignable */}
      <AdminUsersPanel users={rows} />

      {/* matrice rôles × modules — dynamique (backend), repli statique lecture seule */}
      <AdminPermissionsPanel
        matrix={permissions?.matrix ?? MODULE_ACCESS}
        editable={permissions !== null}
      />

      {/* agences + paramètres régionaux */}
      {/* <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Agences" />
          <p className="font-mono text-[10px] leading-relaxed text-muted">
            Aucune table « agences » n&apos;existe dans neurones.db — cette section a été retirée
            plutôt que remplie avec des données inventées. Les comptes utilisateurs réels sont
            listés ci-dessus.
          </p>
        </Panel>
        <Panel>
          <PanelHead title="Paramètres régionaux" />
          <div className="flex flex-col gap-3.5">
            <ParamSelect label="Devise par défaut" options={["Euro (€)", "Dollar US ($)", "Franc CFA (FCFA)"]} />
            <ParamSelect label="Langue de l'interface" options={["Français", "English", "Español"]} />
            <ParamSelect label="Fuseau horaire" options={["Europe/Paris (UTC+1)", "Africa/Abidjan (UTC+0)", "America/New_York (UTC-5)"]} />
          </div>
        </Panel>
      </div> */}
    </>
  );
}

function ParamSelect({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] text-muted">{label}</div>
      <select className={SELECT_CLASS}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
