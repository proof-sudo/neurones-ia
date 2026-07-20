"use client";

import { useEffect } from "react";

/**
 * Modal accessible : backdrop cliquable, fermeture Échap, scroll du body
 * verrouillé pendant l'ouverture. Rendu uniquement quand `open`.
 */
export function Modal({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(5,8,16,0.72)] px-5 py-10 backdrop-blur-[2px]"
    >
      <div
        className={`mb-10 w-full rounded-2xl border border-line bg-panel ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
