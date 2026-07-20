"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions";
import { ADMIN_ROLES } from "@/lib/fixtures/admin";
import type { Role } from "@/lib/types";

/** Ligne utilisateur — compte réel de la table users. */
export interface UserRow {
  id: number;
  nom: string;
  email: string;
  role: string;
  actif: boolean;
}

const FIELD_CLASS =
  "w-full rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  dg: "Direction Générale",
  dir_commercial: "Direction Commerciale",
  dir_operations: "Direction des Opérations",
  presale: "Équipe Avant-Vente",
  dir_financier: "Direction Financière",
  commercial: "Commercial",
};

interface FormState {
  nom: string;
  email: string;
  role: string;
  actif: boolean;
  password: string;
}

export function AdminUsersPanel({ users }: { users: UserRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  return (
    <Panel className="mb-4">
      <PanelHead title="Utilisateurs">
        <button
          onClick={() => setCreating(true)}
          title="Créer un nouveau compte"
          className="cursor-pointer rounded-lg bg-ai px-3 py-[7px] text-[11.5px] font-semibold text-white"
        >
          Inviter un utilisateur
        </button>
      </PanelHead>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {["Nom", "Rôle", "Email", "Statut", ""].map((h, i) => (
              <th
                key={i}
                className="border-b border-line px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.email} className="border-b border-line last:border-none">
              <td className="px-2 py-2.5 text-text">{u.nom || "—"}</td>
              <td className="px-2 py-2.5">
                <Badge variant="warm">{u.role}</Badge>
              </td>
              <td className="px-2 py-2.5">{u.email}</td>
              <td className="px-2 py-2.5">
                <Badge variant={u.actif ? "open" : "risk"}>
                  {u.actif ? "actif" : "désactivé"}
                </Badge>
              </td>
              <td className="px-2 py-2.5 text-right">
                <button
                  onClick={() => setEditing(u)}
                  className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[11.5px] text-text hover:border-ai"
                >
                  Modifier
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {creating && (
        <UserFormModal
          open
          title="Inviter un utilisateur"
          submitLabel="Créer le compte"
          initial={{ nom: "", email: "", role: "commercial", actif: true, password: "" }}
          passwordRequired
          showStatut={false}
          onClose={() => setCreating(false)}
          onSubmit={(f) =>
            createUserAction({
              email: f.email,
              full_name: f.nom,
              role: f.role as Role,
              password: f.password,
            })
          }
        />
      )}

      {editing && (
        <UserFormModal
          open
          title={`Modifier — ${editing.nom || editing.email}`}
          submitLabel="Enregistrer"
          initial={{
            nom: editing.nom,
            email: editing.email,
            role: editing.role,
            actif: editing.actif,
            password: "",
          }}
          passwordRequired={false}
          showStatut
          onClose={() => setEditing(null)}
          onSubmit={(f) =>
            updateUserAction(editing.id, {
              full_name: f.nom,
              email: f.email,
              role: f.role as Role,
              is_active: f.actif,
              ...(f.password ? { password: f.password } : {}),
            })
          }
          onDelete={() => deleteUserAction(editing.id)}
        />
      )}
    </Panel>
  );
}

function UserFormModal({
  open,
  title,
  submitLabel,
  initial,
  passwordRequired,
  showStatut,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initial: FormState;
  passwordRequired: boolean;
  showStatut: boolean;
  onClose: () => void;
  onSubmit: (f: FormState) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDelete?: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function submitDelete() {
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (result.ok) {
        onClose();
      } else {
        setConfirmDelete(false);
        setError(result.error);
      }
    });
  }

  // Rôles proposés : les 7 personas + le rôle actuel s'il est hérité (user/viewer)
  const roleOptions = ADMIN_ROLES.includes(initial.role as Role)
    ? ADMIN_ROLES
    : [initial.role, ...ADMIN_ROLES];

  function submit() {
    if (!form.email.trim() || !form.email.includes("@")) {
      setError("Email invalide.");
      return;
    }
    if (passwordRequired && form.password.length < 6) {
      setError("Mot de passe trop court (6 caractères minimum).");
      return;
    }
    if (form.password && form.password.length < 6) {
      setError("Mot de passe trop court (6 caractères minimum).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(form);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-[440px] p-6">
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-[16px]">{title}</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-muted hover:border-ai hover:text-text"
        >
          Fermer ✕
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        <Field label="Nom complet">
          <input
            className={FIELD_CLASS}
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
        </Field>
        <Field label="Email professionnel">
          <input
            type="email"
            className={FIELD_CLASS}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Rôle (détermine les modules accessibles — voir la matrice ci-dessous)">
          <select
            className={FIELD_CLASS}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ? `${ROLE_LABELS[r]} (${r})` : r}
              </option>
            ))}
          </select>
        </Field>
        {showStatut && (
          <Field label="Statut du compte">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                className="h-[15px] w-[15px] accent-ai"
                checked={form.actif}
                onChange={(e) => setForm({ ...form, actif: e.target.checked })}
              />
              actif (décocher pour désactiver la connexion)
            </label>
          </Field>
        )}
        <Field
          label={
            passwordRequired ? "Mot de passe initial" : "Nouveau mot de passe (optionnel)"
          }
        >
          <input
            type="password"
            placeholder={passwordRequired ? "6 caractères minimum" : "laisser vide pour ne pas changer"}
            className={FIELD_CLASS}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
      </div>

      {error && <div className="mt-3 text-[11.5px] text-bad">{error}</div>}

      <button
        onClick={submit}
        disabled={pending}
        className="mt-4 w-full cursor-pointer rounded-lg bg-ai px-3 py-[9px] text-[12.5px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : submitLabel}
      </button>

      {onDelete && (
        <button
          onClick={submitDelete}
          disabled={pending}
          className={
            confirmDelete
              ? "mt-2.5 w-full cursor-pointer rounded-lg bg-bad px-3 py-[9px] text-[12.5px] font-semibold text-white disabled:opacity-50"
              : "mt-2.5 w-full cursor-pointer rounded-lg border border-bad/40 bg-bad/10 px-3 py-[9px] text-[12.5px] font-semibold text-bad disabled:opacity-50"
          }
        >
          {confirmDelete
            ? "⚠ Confirmer la suppression définitive"
            : "Supprimer ce compte…"}
        </button>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] text-muted">{label}</div>
      {children}
    </div>
  );
}
