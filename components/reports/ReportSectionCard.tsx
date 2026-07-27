/**
 * ReportSectionCard — reusable card wrapper for each report section.
 * Provides consistent numbering badge, title, and content slot.
 */

type Props = {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function ReportSectionCard({
  stepNumber,
  title,
  children,
  className = "",
}: Props) {
  return (
    <section
      className={`rounded-2xl border border-border bg-surface p-6 lg:p-8 ${className}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
          {String(stepNumber).padStart(2, "0")}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}
