"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { workPaths } from "@/lib/work/paths";
import { projectWorkLabel } from "@/lib/work/stages";
import { DealAmountCell } from "@/components/work/DealAmountCell";
import { asFinanceFrequency } from "@/lib/accounting/finance";

export type CompanyProjectSummary = {
  id: string;
  title: string;
  stage: string | null;
  status: string | null;
  deal_value: number | null;
  deal_frequency: string | null;
  bd_record_id: string | null;
  contract_confirmed_at: string | null;
};

function groupProjects(projects: CompanyProjectSummary[]) {
  const live: CompanyProjectSummary[] = [];
  const leads: CompanyProjectSummary[] = [];
  const done: CompanyProjectSummary[] = [];
  const lost: CompanyProjectSummary[] = [];

  for (const p of projects) {
    const label = projectWorkLabel(p);
    if (label === "Live") live.push(p);
    else if (label === "Lead" || label === "Prospect") leads.push(p);
    else if (label === "Done") done.push(p);
    else if (label === "Lost") lost.push(p);
    else live.push(p);
  }
  return { live, leads, done, lost };
}

function ProjectRow({ p }: { p: CompanyProjectSummary }) {
  return (
    <Link
      href={workPaths.project(p.id)}
      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-surface-raised transition-colors"
    >
      <div className="min-w-0 flex items-center gap-2">
        <LayoutDashboard className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-text-primary truncate">{p.title}</p>
          <p className="text-[11px] text-text-secondary">{projectWorkLabel(p)}</p>
        </div>
      </div>
      <DealAmountCell
        amount={Number(p.deal_value || 0) || null}
        frequency={asFinanceFrequency(p.deal_frequency)}
        align="right"
      />
    </Link>
  );
}

export function CompanyProjectsPanel({
  projects,
}: {
  projects: CompanyProjectSummary[];
}) {
  if (projects.length === 0) return null;
  const { live, leads, done, lost } = groupProjects(projects);

  const sections = [
    { key: "live", label: "Live clients", items: live },
    { key: "leads", label: "Active leads", items: leads },
    { key: "done", label: "Done", items: done },
    { key: "lost", label: "Lost", items: lost },
  ].filter((s) => s.items.length > 0);

  return (
    <section className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Projects with this company</h2>
        <p className="text-[12px] text-text-secondary mt-0.5">
          Each project has its own delivery file. Open the one you need.
        </p>
      </div>
      {sections.map((s) => (
        <div key={s.key}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            {s.label}
          </p>
          <div className="space-y-1.5">
            {s.items.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
