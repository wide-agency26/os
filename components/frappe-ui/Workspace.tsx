import type { ComponentType, ReactNode } from "react";
import Link from "next/link";

interface WorkspaceProps {
  children: ReactNode;
  /** Wider content shell (e.g. Brand Guideline Builder). Default max-w-5xl. */
  wide?: boolean;
}

export function Workspace({ children, wide = false }: WorkspaceProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div
        className={
          wide
            ? "w-full max-w-[1440px] mx-auto px-4 py-4 sm:px-6 min-w-0"
            : "max-w-5xl mx-auto px-4 py-5 sm:p-8 min-w-0"
        }
      >
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ShortcutCard({
  title,
  icon: Icon,
  href,
  count,
}: {
  title: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  href: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface hover:border-text-muted/40 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="text-text-muted group-hover:text-text-primary transition-colors">
          <Icon size={16} strokeWidth={1.75} />
        </div>
        <span className="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">
          {title}
        </span>
      </div>
      {count !== undefined && (
        <span className="bg-surface-raised text-text-secondary text-[11px] font-semibold px-2 py-0.5 rounded-md">
          {count}
        </span>
      )}
    </Link>
  );
}

export function MasterList({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
