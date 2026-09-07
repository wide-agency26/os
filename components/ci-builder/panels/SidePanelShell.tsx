"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export function SidePanelShell({
  open,
  title,
  onClose,
  children,
  widthClass = "w-[380px]",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed top-0 right-0 z-[101] flex h-dvh ${widthClass} max-w-[90vw] flex-col gap-5 overflow-y-auto border-l border-[var(--ci-border,#eaeaea)] bg-[var(--ci-surface,#fff)] p-7 shadow-xl`}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--ci-text,#111)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--ci-text-muted,#666)] hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function PanelField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] uppercase tracking-wide text-[var(--ci-text-muted,#666)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export const panelInputClass =
  "w-full rounded-lg border border-[var(--ci-border,#eaeaea)] bg-[var(--ci-bg,#fff)] px-3 py-2.5 text-sm text-[var(--ci-text,#111)] outline-none focus:ring-2 focus:ring-[var(--ci-accent,#70657e)]/40";
