import { clsx } from "clsx";

export function AiChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ai/35 bg-ai-dim px-2 py-[3px] pl-1.5 font-mono text-[10.5px] tracking-[0.03em] text-ai",
        className,
      )}
    >
      <span className="animate-pulse-dot h-[5px] w-[5px] shrink-0 rounded-full bg-ai" />
      {children}
    </span>
  );
}
