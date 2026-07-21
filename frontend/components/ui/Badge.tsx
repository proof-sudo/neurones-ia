import { clsx } from "clsx";

type BadgeVariant = "hot" | "warm" | "cold" | "open" | "risk";

const VARIANTS: Record<BadgeVariant, string> = {
  hot: "bg-bad/15 text-bad",
  warm: "bg-warn/15 text-warn",
  cold: "bg-[#8C6E54]/15 text-[#8C6E54]",
  open: "bg-good/15 text-good",
  risk: "bg-bad/15 text-bad",
};

export function Badge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-block rounded-xl px-2 py-0.5 font-mono text-[10.5px]",
        VARIANTS[variant],
      )}
    >
      {children}
    </span>
  );
}
