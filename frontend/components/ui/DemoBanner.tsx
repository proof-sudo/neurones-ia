export function DemoBanner({ reason }: { reason: "offline" | "error" }) {
  return (
    <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-warn">
      ⚠ <b>Mode démonstration</b> —{" "}
      {reason === "offline"
        ? "session ouverte sans backend : les données affichées sont des fixtures, pas les données réelles Odoo."
        : "le backend est injoignable : repli sur les données de démonstration (fixtures)."}{" "}
      Démarrez l&apos;API FastAPI puis reconnectez-vous pour voir les données réelles.
    </div>
  );
}
