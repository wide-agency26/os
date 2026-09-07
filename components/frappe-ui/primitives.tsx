"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary:
    "border border-border bg-surface text-text-primary hover:bg-surface-raised",
  ghost: "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
  danger: "bg-red-50 text-danger border border-red-200 hover:bg-red-100",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return [
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 sm:py-1.5 min-h-11 sm:min-h-0 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    BUTTON_STYLES[variant],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[13px] text-text-secondary mt-1">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-surface ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] text-text-secondary border border-dashed border-border rounded-lg px-4 py-5">
      {children}
    </p>
  );
}

export function CollapsibleSection({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-text-primary">
          {title}
        </span>
        <span className="flex items-center gap-2 text-[12px] text-text-muted shrink-0">
          {meta}
          {open ? (
            <ChevronDown size={14} strokeWidth={1.75} />
          ) : (
            <ChevronRight size={14} strokeWidth={1.75} />
          )}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-3">{children}</div>
      ) : null}
    </div>
  );
}

export function DoneSummary({
  label,
  count,
  onExpand,
}: {
  label: string;
  count: number;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full text-left text-[13px] text-text-muted border border-dashed border-border rounded-lg px-3 py-2 hover:bg-surface-raised transition-colors"
    >
      {label} — completed ({count})
    </button>
  );
}
