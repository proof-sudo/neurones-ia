"use client";

import { useState, useTransition } from "react";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { resetPermissionsAction, updatePermissionAction } from "@/app/actions";
import { ADMIN_ROLES } from "@/lib/fixtures/admin";
import { NAV_MODULES } from "@/lib/navigation";
import type { Role } from "@/lib/types";

/**
 * Matrice rôles × modules ÉDITABLE. Chaque case (hors colonne admin) modifie
 * réellement les droits appliqués par le serveur : bascule optimiste, PATCH
 * /v1/auth/permissions via l'action serveur, retour en arrière + message si
 * le backend refuse (ex. dernière vue d'un rôle).
 *
 * `editable=false` = repli lecture seule quand l'endpoint permissions du
 * backend est indisponible (matrice statique affichée à titre indicatif).
 */
export function AdminPermissionsPanel({
  matrix,
  editable,
}: {
  matrix: Record<string, Record<string, boolean>>;
  editable: boolean;
}) {
  // Surcharges optimistes le temps que le serveur confirme (revalidation /admin)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  const cellKey = (view: string, role: string) => `${view}:${role}`;
  const isChecked = (view: string, role: string) =>
    overrides[cellKey(view, role)] ?? !!matrix[view]?.[role];

  function toggle(view: string, role: Role) {
    const next = !isChecked(view, role);
    setOverrides((o) => ({ ...o, [cellKey(view, role)]: next }));
    setError(null);
    startTransition(async () => {
      const result = await updatePermissionAction(view, role, next);
      if (!result.ok) {
        // Refus serveur → on rétablit la case et on affiche le motif
        setOverrides((o) => {
          const copy = { ...o };
          delete copy[cellKey(view, role)];
          return copy;
        });
        setError(result.error);
      }
    });
  }

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setError(null);
    startTransition(async () => {
      const result = await resetPermissionsAction();
      if (result.ok) setOverrides({});
      else setError(result.error);
    });
  }

  return (
    <Panel className="mb-4">
      <PanelHead title="Rôles & permissions">
        {editable && (
          <button
            onClick={reset}
            disabled={pending}
            title="Supprime toutes les modifications et revient à la matrice par défaut"
            className={
              confirmReset
                ? "cursor-pointer rounded-lg bg-bad px-3 py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-50"
                : "cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-[7px] text-[11.5px] text-text hover:border-ai disabled:opacity-50"
            }
          >
            {confirmReset ? "⚠ Confirmer la réinitialisation" : "Rétablir les droits par défaut"}
          </button>
        )}
      </PanelHead>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
                Module
              </th>
              {ADMIN_ROLES.map((r) => (
                <th key={r} className="border-b border-line px-2 pb-2 text-center text-[10.5px] font-medium text-muted">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NAV_MODULES.map((m) => (
              <tr key={m.view} className="border-b border-line last:border-none">
                <td className="px-2 py-2 text-text">
                  {m.icon} {m.label}
                </td>
                {ADMIN_ROLES.map((r) =>
                  r === "admin" ? (
                    <td key={r} className="px-2 py-2 text-center">
                      {/* admin : toujours coché, non modifiable (grisé comme le mockup) */}
                      <input
                        type="checkbox"
                        className="h-[15px] w-[15px] cursor-not-allowed"
                        checked
                        disabled
                        title="L'administrateur a toujours accès à tout"
                        readOnly
                      />
                    </td>
                  ) : (
                    <td key={r} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className={
                          editable
                            ? "h-[15px] w-[15px] cursor-pointer accent-ai disabled:cursor-wait"
                            : "pointer-events-none h-[15px] w-[15px] accent-ai"
                        }
                        checked={isChecked(m.view, r)}
                        disabled={editable && pending}
                        onChange={editable ? () => toggle(m.view, r) : undefined}
                        readOnly={!editable}
                        tabIndex={editable ? undefined : -1}
                        title={
                          editable
                            ? `${m.label} × ${r} — cliquer pour modifier le droit appliqué par le serveur`
                            : "Lecture seule — endpoint permissions du backend indisponible"
                        }
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className="mt-3 text-[11.5px] text-bad">Modification refusée : {error}</div>}
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
        Une case par module réel de la sidebar ({NAV_MODULES.length} modules × {ADMIN_ROLES.length}{" "}
        rôles). L&apos;administrateur a toujours accès à tout.{" "}
        {editable
          ? "Matrice ÉDITABLE : chaque case modifie immédiatement les droits appliqués par le serveur (sidebar, routes et API) — persistés en base, effectifs à la prochaine navigation des utilisateurs concernés, sans reconnexion."
          : "Lecture seule : le backend est injoignable ou ne publie pas encore la matrice — valeurs par défaut affichées à titre indicatif."}
      </p>
    </Panel>
  );
}
