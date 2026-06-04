"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  FileSearch,
  LayoutDashboard,
  FolderOpen,
  Zap,
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
      className="w-[240px] shrink-0 flex flex-col h-full bg-white"
      style={{ borderRight: "1px solid #ecedf0" }}
    >
      {/* Brand + bouton fermer (mobile) */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Zap className="w-5 h-5 shrink-0 text-[#0a2a43]" strokeWidth={2.25} />
          <div>
            <p className="text-[14px] font-semibold text-slate-900 leading-none tracking-tight">
              Neurones IA
            </p>
            <p className="text-[11px] mt-1 leading-none text-slate-400">
              Plateforme Intelligence
            </p>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] px-3 mb-2 text-slate-400">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors duration-150 relative",
                      active
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-normal"
                    )}
                  >
                    {/* Left accent */}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#0a2a43]" />
                    )}
                    <Icon
                      className={cn("w-4 h-4 shrink-0", active ? "text-[#0a2a43]" : "text-slate-400")}
                      strokeWidth={2}
                    />
                    <span className="flex-1 leading-none">{label}</span>
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
          <div className="rounded-lg px-3 py-2.5 flex items-center gap-2.5" style={{ border: "1px solid #ecedf0" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold text-[#0a2a43] bg-slate-100">
              {user.full_name ? user.full_name[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-700 truncate leading-none">
                {user.full_name || user.email.split("@")[0]}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-1 leading-none capitalize">
                {user.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* System status */}
        <div className="rounded-lg px-3.5 py-3" style={{ border: "1px solid #ecedf0" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2e7d5b" }} />
              <span className="text-[11px] font-medium text-slate-500">Système actif</span>
            </div>
            <span className="text-[10px] font-mono tabular-nums text-slate-400">v0.1.0</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-[10px] text-slate-400">Claude Sonnet 4.6</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-[10px] text-slate-400">GPT embedding 3-small</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
