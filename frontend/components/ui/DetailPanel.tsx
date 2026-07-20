"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";

/**
 * Panneau de détail déroulant, calé sur le `.detail` du mockup :
 * bordure accent IA, en-tête avec titre + bouton Fermer, corps en grille.
 * S'ouvre au-dessus d'un tableau et se centre à l'écran à l'ouverture.
 */
export function DetailPanel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="mb-[22px] rounded-card border border-ai bg-panel px-5 py-[18px]"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          onClick={onClose}
          className="cursor-pointer border-none bg-transparent text-[13px] text-muted hover:text-text"
        >
          Fermer ✕
        </button>
      </div>
      {children}
    </div>
  );
}

/** Grille de champs libellé/valeur (comme `.detail-body`). */
export function DetailGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("grid grid-cols-2 gap-3.5 lg:grid-cols-4", className)}>{children}</div>
  );
}

/** Un champ libellé (k) + valeur (v). `full` occupe toute la largeur. */
export function DetailItem({
  k,
  full,
  children,
  valueClassName,
}: {
  k: string;
  full?: boolean;
  children: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className={clsx(full && "col-span-full")}>
      <div className="mb-1 text-[11px] text-muted">{k}</div>
      <div className={clsx("font-mono text-[15px] text-text", valueClassName)}>{children}</div>
    </div>
  );
}
