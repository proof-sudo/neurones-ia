"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { logout } from "@/app/actions";
import { NAV_GROUPS, NAV_MODULES } from "@/lib/navigation";
import type { Profile } from "@/lib/types";

const MODULE_BY_VIEW = new Map(NAV_MODULES.map((m) => [m.view, m]));

export function Sidebar({
  allowedViews,
  profile,
}: {
  allowedViews: string[] | null;
  profile: Profile;
}) {
  const pathname = usePathname();
  const allowed = allowedViews ? new Set(allowedViews) : null;
  const canSee = (view: string) => allowed === null || allowed.has(view);

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-line bg-panel px-3.5 py-[22px]">
      {/* brand */}
      <div className="mb-4 flex items-center gap-2.5 border-b border-line px-2 pb-[22px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Neurones" className="h-[26px] w-auto shrink-0" />
      </div>

      {/* nav groups */}
      <nav className="flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const views = group.views.filter(canSee);
          if (views.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="mx-2 mb-2 mt-4 hidden text-[10px] uppercase tracking-[0.09em] text-[#4C5A7A] min-[1300px]:block">
                {group.label}
              </div>
              {views.map((view) => {
                const m = MODULE_BY_VIEW.get(view)!;
                const active = pathname === `/${view}`;
                return (
                  <Link
                    key={view}
                    href={`/${view}`}
                    className={clsx(
                      "mb-0.5 flex items-center gap-2.5 rounded-[9px] border-l-2 px-2.5 py-2.5 text-[13px] transition",
                      active
                        ? "border-ai bg-panel-2 text-text"
                        : "border-transparent text-muted hover:bg-panel-2 hover:text-text",
                    )}
                  >
                    <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center">
                      {m.icon}
                    </span>
                    <span className="hidden whitespace-nowrap min-[1300px]:inline">{m.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* footer */}
      <div className="mt-auto flex flex-col items-start gap-1.5 border-t border-line pt-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-line bg-panel-2 font-mono text-[10px]">
            {profile.initiales}
          </div>
          <span className="hidden text-[11.5px] text-muted min-[1300px]:inline">{profile.nom}</span>
        </div>
        <button
          onClick={() => logout()}
          title="Se déconnecter"
          className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-line bg-panel-2 px-2.5 py-1.5 text-[11.5px] text-muted hover:border-bad hover:text-bad"
        >
          <span aria-hidden>↪</span>
          <span className="hidden min-[1300px]:inline">Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
