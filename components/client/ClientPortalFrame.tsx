"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type ClientProjectChoice = { id: string; title: string };

export function ClientProjectSwitcher({
  projects,
  projectId,
  param = "project",
  extraParams,
}: {
  projects: ClientProjectChoice[];
  projectId: string;
  param?: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const search = useSearchParams();
  if (projects.length <= 1) return null;

  return (
    <label className="block min-w-0 sm:min-w-[200px]">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
        Project
      </span>
      <select
        value={projectId}
        onChange={(e) => {
          const sp = new URLSearchParams(search.toString());
          sp.set(param, e.target.value);
          if (extraParams) {
            for (const [k, v] of Object.entries(extraParams)) sp.set(k, v);
          }
          const path = window.location.pathname;
          router.push(`${path}?${sp.toString()}`);
        }}
        className="w-full border border-border rounded-lg px-3 py-2.5 min-h-11 text-[13px] bg-surface outline-none focus:ring-1 focus:ring-accent"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ClientPortalFrame({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-background min-w-0">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 min-w-0">
        <header className="mb-5 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {eyebrow}
          </p>
          <div className="mt-1 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-[13px] text-text-secondary mt-1 max-w-2xl">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-end gap-2 sm:shrink-0">{actions}</div>
            ) : null}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ClientEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-text-secondary">
        {message}
      </p>
    </div>
  );
}
