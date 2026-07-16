"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";
import { saveAuth, isAuthenticated } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1";

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated()) router.replace("/");
    emailRef.current?.focus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Identifiants incorrects");
        return;
      }
      const data = await res.json();
      saveAuth(data.access_token, data.user);
      router.replace("/");
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez que le backend est démarré.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f7f8fa" }}
    >
      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Zap className="w-8 h-8 text-[#0a2a43] mb-4" strokeWidth={2.25} />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Neurones IA
          </h1>
          <p className="text-sm text-slate-500 mt-1">Connectez-vous à votre espace</p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8 bg-white"
          style={{
            border: "1px solid #ecedf0",
            boxShadow: "none",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Adresse email
              </label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@neurones-tech.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-[#f26a21]/30 focus:border-[#f26a21]"
                style={{
                  background: "#ffffff",
                  border: "1px solid #ecedf0",
                }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-[#f26a21]/30 focus:border-[#f26a21]"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #ecedf0",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="rounded-lg px-4 py-2.5 text-sm text-red-700"
                style={{ background: "#fdeceb", border: "1px solid #f3c7c2" }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:translate-y-px"
              style={{ background: "#f26a21" }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Neurones Technologies — Plateforme IA interne v0.1.0
        </p>
      </div>
    </div>
  );
}
