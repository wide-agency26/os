"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Eye,
  FileText,
  Presentation,
  Receipt,
  ScrollText,
  Search,
} from "lucide-react";
import { buttonClass } from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";

export type WorkToolLink = {
  label: string;
  href: string;
  icon: typeof Search;
};

const PROSPECT_TOOLS: WorkToolLink[] = [
  { label: "Prospect Finder", href: workPaths.findTool, icon: Search },
  { label: "Qualifier", href: workPaths.prospecting, icon: BadgeCheck },
];

const LEAD_TOOLS: WorkToolLink[] = [
  { label: "SOW builder", href: workPaths.sow, icon: FileText },
  { label: "Proposal builder", href: workPaths.propose, icon: Presentation },
  { label: "Quote builder", href: workPaths.quotes, icon: Receipt },
  { label: "Contract builder", href: workPaths.contract, icon: ScrollText },
];

export function WorkSectionTools({
  tools,
  description,
}: {
  tools: WorkToolLink[];
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Tools
        </p>
        {description ? (
          <p className="text-[13px] text-text-secondary mt-1">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={buttonClass("secondary", "inline-flex items-center gap-1.5 text-[12px]")}
          >
            <t.icon size={14} strokeWidth={1.75} />
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function WorkProspectTools() {
  return (
    <WorkSectionTools
      description="Logged prospects live here. Run Find or open Qualifier to move them forward."
      tools={PROSPECT_TOOLS}
    />
  );
}

export function WorkLeadTools() {
  return (
    <WorkSectionTools
      description="Active leads with SOW, proposal, quote, or contract in progress."
      tools={LEAD_TOOLS}
    />
  );
}

export function WorkClientTools() {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Tools
          </p>
          <p className="text-[13px] text-text-secondary mt-1">
            Live delivery work. Open a project or view the portal as they do.
          </p>
        </div>
        <Link href={workPaths.viewAs} className={buttonClass("primary")}>
          <Eye size={14} strokeWidth={1.75} /> View as client
        </Link>
      </div>
    </div>
  );
}

export function WorkSectionShell({
  children,
  tools,
}: {
  children: ReactNode;
  tools?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {tools}
      {children}
    </div>
  );
}
