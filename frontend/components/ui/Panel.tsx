import { clsx } from "clsx";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-card border border-line bg-panel p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-[14.5px] font-semibold">{title}</h3>
      {children}
    </div>
  );
}
