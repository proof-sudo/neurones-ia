"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithCredentials, verifyCredentials } from "@/app/actions";
import type { Profile, Role } from "@/lib/types";

const FIELD_CLASS =
  "w-full cursor-pointer rounded-[9px] border border-line bg-panel px-2.5 py-2 font-mono text-xs text-text focus:border-ai focus:outline-none";

export function AuthScreen({
  profiles,
  serverError,
}: {
  profiles: Profile[];
  serverError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Modale « Sales IA vous attend » : profil connecté + rôle réel renvoyé par le serveur
  const [welcome, setWelcome] = useState<{ profile: Profile; role: Role } | null>(null);

  async function submitAuth() {
    if (!email.trim() || !password.trim()) {
      setError("Merci de renseigner un email et un mot de passe.");
      return;
    }
    setError(null);
    setBusy(true);
    // Étape 1 : vérification des identifiants SANS pose de cookie (sinon le
    // refresh du routeur redirige avant l'affichage de la modale).
    // Le rôle effectif est celui du COMPTE authentifié, pas du select.
    const result = await verifyCredentials(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(`Connexion refusée : ${result.error}`);
      return;
    }
    const profile = profiles.find((p) => p.role === result.role) ?? profiles[0];
    setWelcome({ profile, role: result.role });
  }

  async function enterCockpit() {
    if (!welcome) return;
    // Étape 2 : connexion effective (JWT posé en cookie httpOnly) puis entrée.
    const result = await loginWithCredentials(email, password);
    if (!result.ok) {
      setWelcome(null);
      setError(`Connexion refusée : ${result.error}`);
      return;
    }
    // `home` = 1re vue autorisée selon la matrice DYNAMIQUE du backend
    router.push(`/${result.home}`);
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, #FFE8D6, var(--color-ink) 60%)",
      }}
    >
      <div className="mb-9 flex max-w-[400px] flex-col items-center text-center">
        <h1 className="my-2.5 text-[26px]">Connexion</h1>
        <p className="text-[12.5px] text-muted">
          Identifiez-vous pour accéder à votre espace
        </p>
      </div>

      {serverError && (
        <div className="mb-6 max-w-[400px] rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-center text-[12.5px] text-bad">
          Connexion refusée par le serveur : {serverError}
        </div>
      )}

      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-panel p-7">
        <div className="mb-9 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Neurones" className="mb-3.5 h-10 w-auto" />
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ai">
            ● Neurones Technologies — cockpit prédictif
          </div>
        </div>
        <div className="mb-3.5">
          <div className="mb-1.5 text-[11px] text-muted">Email professionnel</div>
          <input
            type="email"
            placeholder="prenom@neuronestech.com"
            className={FIELD_CLASS}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-1.5">
          <div className="mb-1.5 text-[11px] text-muted">Mot de passe</div>
          <input
            type="password"
            placeholder="••••••••"
            className={FIELD_CLASS}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAuth();
            }}
          />
        </div>
        {error && <div className="my-1.5 text-[11.5px] text-bad">{error}</div>}
        <button
          onClick={submitAuth}
          disabled={busy}
          className="mt-2.5 w-full cursor-pointer rounded-lg bg-ai px-3 py-[9px] text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </div>

      {welcome && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(5,8,16,0.72)] px-5 py-10 backdrop-blur-[2px]"
        >
          <div className="mb-10 w-full max-w-[480px] rounded-2xl border border-line border-l-[3px] border-l-ai bg-panel p-6">
            <h2 className="text-[16px]">✺ Bienvenue</h2>
            <div className="mt-2.5 mb-2.5 text-[12.5px] text-muted">
              Bienvenue, <b className="text-text">{welcome.profile.nom}</b>. Voici ce que Sales IA a
              préparé pour vous aujourd&apos;hui :
            </div>
            <div className="mb-4 rounded-xl border border-line border-l-[3px] border-l-ai bg-panel p-3 text-[12.5px] text-muted">
              Aucun signal prioritaire particulier détecté pour ce profil pour l&apos;instant — votre
              espace est prêt.
            </div>
            <button
              onClick={enterCockpit}
              className="mt-4 w-full cursor-pointer rounded-lg bg-ai px-3 py-[9px] text-[12.5px] font-semibold text-white"
            >
              Accéder à mon espace →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
