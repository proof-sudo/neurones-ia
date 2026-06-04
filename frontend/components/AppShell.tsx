"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Zap } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { getUser, isAuthenticated, type AuthUser } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isPublic) { setChecked(true); return; }
    if (!isAuthenticated()) { router.replace("/login"); return; }
    setUser(getUser());
    setChecked(true);
  }, [pathname, isPublic, router]);

  // Fermer la sidebar au changement de route
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (!checked) return null;
  if (isPublic) return <>{children}</>;

  return (
    <>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar : fixed sur mobile, relative sur desktop */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50",
          "lg:relative lg:z-auto lg:translate-x-0",
          "transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Barre mobile */}
        <div
          className="lg:hidden shrink-0 flex items-center gap-3 px-4 py-3 bg-white"
          style={{ borderBottom: "1px solid #ecedf0" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0 text-[#0a2a43]" strokeWidth={2.25} />
            <span className="text-sm font-semibold text-slate-900 tracking-tight">Neurones IA</span>
          </div>
        </div>

        {children}
      </main>
    </>
  );
}
