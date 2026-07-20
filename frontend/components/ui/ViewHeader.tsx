export function ViewHeader({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
      <div>
        <div className="mb-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
          {eyebrow}
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
        {sub && <div className="mt-1 text-[13px] text-muted">{sub}</div>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

export function ContextNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-l-[3px] border-line border-l-[#8C6E54] bg-panel px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted">
      {children}
    </div>
  );
}
