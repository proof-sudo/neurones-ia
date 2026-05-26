"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  FileSearch,
  LayoutDashboard,
  FolderOpen,
  Zap,
  ChevronRight,
  LogOut,
  Rss,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type AuthUser, clearAuth } from "@/lib/auth";

const navSections = [
  {
    label: "Vue d'ensemble",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "⌘1" },
    ],
  },
  {
    label: "Modules IA",
    items: [
      { href: "/chat",     label: "Connaissance", icon: MessageSquare, shortcut: "⌘2" },
      { href: "/ged",      label: "Documents",    icon: FolderOpen,    shortcut: "⌘3" },
      { href: "/presales", label: "Avant-vente",  icon: FileSearch,    shortcut: "⌘4" },
      { href: "/veille",   label: "Veille AO",    icon: Rss,           shortcut: "⌘5" },
    ],
  },
];

export function Sidebar({ user, onClose }: { user?: AuthUser | null; onClose?: () => void }) {
  const path = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  return (
    <aside
      className="w-[240px] shrink-0 flex flex-col h-full"
      style={{
        background: "linear-gradient(180deg, #0a0e1a 0%, #0d1526 60%, #0a0e1a 100%)",
        borderRight: "1px solid rgba(139,92,246,0.12)",
      }}
    >
      {/* Brand + bouton fermer (mobile) */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5 shrink-0">
      <Link
        href="/"
        className="flex items-center gap-3 group"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)",
            boxShadow: "0 0 24px rgba(109,40,217,0.5), 0 0 8px rgba(37,99,235,0.3)",
          }}
        >
          <Zap className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[14px] font-bold text-white leading-none tracking-tight">
            Neurones IA
          </p>
          <p className="text-[11px] mt-0.5 leading-none font-medium"
            style={{ color: "rgba(139,92,246,0.7)" }}>
            Plateforme Intelligence
          </p>
        </div>
      </Link>
      {onClose && (
        <button
          onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px mb-5" style={{
        background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), rgba(37,99,235,0.2), transparent)"
      }} />

      {/* Nav sections */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em] px-3 mb-2"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, shortcut }) => {
                const active = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 relative overflow-hidden group",
                      active ? "text-white" : "hover:text-white"
                    )}
                    style={active ? {
                      background: "linear-gradient(135deg, rgba(109,40,217,0.25) 0%, rgba(37,99,235,0.18) 100%)",
                      boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.3)",
                    } : undefined}
                  >
                    {/* Hover bg */}
                    {!active && (
                      <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(255,255,255,0.04)" }} />
                    )}

                    {/* Left accent */}
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                        style={{ background: "linear-gradient(180deg, #8b5cf6, #3b82f6)" }}
                      />
                    )}

                    {/* Icon */}
                    <span className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                      active
                        ? "text-violet-400"
                        : "text-slate-600 group-hover:text-slate-400",
                    )}
                      style={active ? {
                        background: "rgba(139,92,246,0.15)",
                      } : undefined}
                    >
                      <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 2} />
                    </span>

                    {/* Label */}
                    <span className={cn("flex-1 leading-none", active ? "" : "text-slate-400 group-hover:text-slate-200")}>
                      {label}
                    </span>

                    {/* Shortcut / chevron */}
                    {active ? (
                      <ChevronRight
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: "rgba(139,92,246,0.5)" }}
                      />
                    ) : (
                      <span
                        className="text-[10px] font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "rgba(255,255,255,0.2)" }}
                      >
                        {shortcut}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-3 pb-5 pt-3 space-y-2">
        {/* User card */}
        {user && (
          <div
            className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Avatar initiale */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)" }}
            >
              {user.full_name ? user.full_name[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-300 truncate leading-none">
                {user.full_name || user.email.split("@")[0]}
              </p>
              <p className="text-[10px] text-slate-600 truncate mt-0.5 leading-none capitalize">
                {user.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* System status */}
        <div
          className="rounded-xl px-3.5 py-3"
          style={{
            background: "rgba(139,92,246,0.06)",
            border: "1px solid rgba(139,92,246,0.12)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex items-center justify-center w-3 h-3">
                <span className="absolute w-3 h-3 rounded-full bg-emerald-500/25 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 relative z-10" />
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Système actif</span>
            </div>
            <span className="text-[10px] font-mono tabular-nums text-slate-600">v0.1.0</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-violet-500" />
              <span className="text-[10px] text-slate-500">Claude Sonnet 4.6</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-500" />
              <span className="text-[10px] text-slate-500">GPT embedding 3-small</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
