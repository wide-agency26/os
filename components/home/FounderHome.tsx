"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MyWeekClient } from "@/components/pm/MyWeekClient";
import { formatEuro } from "@/lib/accounting/types";
import type { FounderHomeShellData, MyLiveProject } from "@/lib/home/load-founder";
import type { WorkGroup } from "@/lib/work/stages";
import { WORK_GROUP_LABELS } from "@/lib/work/stages";
import { workPaths } from "@/lib/work/paths";
import { workRowHref } from "@/lib/work/navigation";
import { CompanyLogoMark } from "@/components/crm/CompanyLogo";
import type { WorkHubRow } from "@/lib/work/load-hub";
import { DealAmountCell } from "@/components/work/DealAmountCell";
import { AccessRequestRow } from "@/components/notifications/AccessRequestRow";
import {
  CollapsibleSection,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/frappe-ui/primitives";
import { OfferingChips } from "@/components/offerings/OfferingChips";

const WORK_GROUPS: WorkGroup[] = [
  "find",
  "qualify",
  "propose",
  "contract",
  "live",
  "done",
];

function CompletionRing({ pct }: { pct: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative w-11 h-11 shrink-0" title={`${pct}% complete`}>
      <svg width="44" height="44" viewBox="0 0 44 44" className="block">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-text-primary">
        {pct}%
      </span>
    </div>
  );
}

function LiveProjectCard({ p }: { p: MyLiveProject }) {
  return (
    <Link
      href={workPaths.project(p.id)}
      className={`flex items-center gap-3 rounded-lg px-3 py-3 bg-surface border transition-colors hover:border-text-muted ${
        p.daysQuiet != null ? "border-warning/40" : "border-border"
      }`}
    >
      <CompanyLogoMark
        label={p.clientLabel}
        logoUrl={p.logoUrl}
        website={p.website}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text-primary truncate">
          {p.title}
        </p>
        <p className="text-[12px] text-text-secondary truncate">{p.clientLabel}</p>
        {p.offerings.length > 0 ? (
          <div className="mt-1" onClick={(e) => e.preventDefault()}>
            <OfferingChips value={p.offerings} editable={false} compact />
          </div>
        ) : null}
        <p className="text-[11px] mt-0.5 tabular-nums">
          {p.waitingOnYou > 0 ? (
            <span className="font-semibold text-text-primary">
              {p.waitingOnYou} waiting on you
            </span>
          ) : (
            <span className="text-text-muted">Nothing waiting on you</span>
          )}
          {p.daysQuiet != null ? (
            <span className="text-warning font-medium">
              {" · "}Quiet {p.daysQuiet}d
            </span>
          ) : null}
        </p>
      </div>
      <CompletionRing pct={p.percentComplete} />
    </Link>
  );
}

export function FounderHome({
  data,
  userId,
  deals,
  books,
}: {
  data: FounderHomeShellData;
  userId: string;
  deals?: ReactNode;
  books?: ReactNode;
}) {
  const [workFilter, setWorkFilter] = useState<WorkGroup | "lose" | null>(null);

  const workRows = useMemo(() => {
    if (!workFilter) return [];
    return data.rows
      .filter((r) => r.group === workFilter)
      .sort((a, b) => (b.dealValue || 0) - (a.dealValue || 0))
      .slice(0, 8);
  }, [data.rows, workFilter]);

  const workMore =
    workFilter != null
      ? Math.max(0, data.groupCounts[workFilter] - workRows.length)
      : 0;

  const quietNotOnMine = data.stale.filter(
    (s) => !data.myLive.some((p) => p.id === s.id)
  );

  const waitingTotal = data.myLive.reduce((s, p) => s + p.waitingOnYou, 0);
  const quietMine = data.myLive.filter((p) => p.daysQuiet != null).length;
  const pendingAccess = data.pendingAccess ?? [];

  function workHref(group: WorkGroup | "lose", row?: WorkHubRow) {
    if (row) return workRowHref(row, "full");
    if (group === "live") return workPaths.clients;
    if (group === "done" || group === "lose") {
      return `${workPaths.archived}?filter=${group}`;
    }
    if (group === "find" || group === "qualify") return workPaths.prospects;
    if (group === "propose" || group === "contract") return workPaths.leads;
    return workPaths.hub;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Home"
        subtitle="What needs you, then the pipeline and the books."
      />

      <section>
        <div className="flex items-end justify-between mb-3 gap-3">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Needs you
            </h3>
            {data.myLive.length > 0 || pendingAccess.length > 0 || deals ? (
              <p className="text-[12px] text-text-secondary mt-0.5 tabular-nums">
                {waitingTotal > 0
                  ? `${waitingTotal} waiting on you`
                  : pendingAccess.length === 0
                    ? "Nothing waiting on you"
                    : null}
                {quietMine > 0 ? ` · ${quietMine} quiet` : ""}
              </p>
            ) : null}
          </div>
          <Link
            href={workPaths.clients}
            className="text-[12px] font-medium text-text-muted hover:text-text-primary shrink-0 transition-colors"
          >
            All live
          </Link>
        </div>
        {deals}
        {pendingAccess.length > 0 ? (
          <Panel className="mb-3 overflow-hidden">
            <div className="px-3 py-2 bg-surface-raised flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Portal access
              </p>
              <Link
                href="/app/crm/access"
                className="text-[12px] font-medium text-text-secondary hover:text-text-primary"
              >
                Open access
              </Link>
            </div>
            {pendingAccess.map((m) => (
              <div key={m.id} className="px-3 py-3 border-t border-border">
                <AccessRequestRow member={m} />
              </div>
            ))}
          </Panel>
        ) : null}
        {data.myLive.length === 0 ? (
          pendingAccess.length === 0 && !deals ? (
            <EmptyState>No live projects assigned to you right now.</EmptyState>
          ) : null
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.myLive.map((p) => (
              <LiveProjectCard key={p.id} p={p} />
            ))}
          </div>
        )}
        {quietNotOnMine.length > 0 ? (
          <Panel className="mt-3 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-warning mb-1">
              Other live projects gone quiet
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {quietNotOnMine.map((p) => (
                <Link
                  key={p.id}
                  href={workPaths.project(p.id)}
                  className="text-[12px] text-text-primary hover:underline"
                >
                  {p.title}
                  <span className="text-warning"> · {p.daysQuiet}d</span>
                </Link>
              ))}
            </div>
          </Panel>
        ) : null}
      </section>

      <CollapsibleSection title="My week" defaultOpen={false}>
        <MyWeekClient userId={userId} embedded />
      </CollapsibleSection>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Pipeline
          </h3>
          <p className="text-[12px] text-text-secondary tabular-nums">
            {formatEuro(data.pipelineEuro)}
          </p>
        </div>
        <Panel className="overflow-hidden">
          <div className="flex divide-x divide-border overflow-x-auto">
            {WORK_GROUPS.map((g) => {
              const selected = workFilter === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setWorkFilter((prev) => (prev === g ? null : g))}
                  aria-pressed={selected}
                  className={`flex-1 min-w-[5.5rem] text-left px-3 py-3 transition-colors ${
                    selected ? "bg-surface-raised" : "hover:bg-surface-raised/60"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {WORK_GROUP_LABELS[g]}
                  </p>
                  <p className="text-lg font-semibold text-text-primary mt-1 tabular-nums">
                    {data.groupCounts[g]}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5 tabular-nums">
                    {formatEuro(data.groupEuro[g])}
                  </p>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setWorkFilter((prev) => (prev === "lose" ? null : "lose"))
              }
              aria-pressed={workFilter === "lose"}
              className={`flex-1 min-w-[5.5rem] text-left px-3 py-3 transition-colors ${
                workFilter === "lose"
                  ? "bg-surface-raised"
                  : "hover:bg-surface-raised/60"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Lose
              </p>
              <p className="text-lg font-semibold text-text-muted mt-1 tabular-nums">
                {data.groupCounts.lose}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5 tabular-nums">
                {formatEuro(data.groupEuro.lose)}
              </p>
            </button>
          </div>
        </Panel>

        {workFilter ? (
          <Panel className="mt-3 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-raised">
              <p className="text-[12px] font-semibold text-text-primary">
                {WORK_GROUP_LABELS[workFilter]}
                <span className="font-normal text-text-secondary">
                  {" · "}
                  {data.groupCounts[workFilter]} projects
                </span>
              </p>
              <Link
                href={workHref(workFilter)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-text-primary hover:underline"
              >
                Open in Work <ArrowRight size={12} strokeWidth={1.75} />
              </Link>
            </div>
            {workRows.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-text-secondary">
                Nothing in this stage.
              </p>
            ) : (
              <ul>
                {workRows.map((r) => (
                  <li
                    key={r.projectId || r.companyId}
                    className="border-b border-border last:border-0"
                  >
                    <Link
                      href={workHref(workFilter, r)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-raised"
                    >
                      <CompanyLogoMark
                        label={r.label}
                        logoUrl={r.logoUrl}
                        website={r.website}
                        size={28}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {r.projectTitle || r.label}
                        </p>
                        <p className="text-[11px] text-text-secondary truncate">
                          {r.projectTitle
                            ? r.label
                            : r.nextAction || r.crmStatus || "—"}
                        </p>
                      </div>
                      <DealAmountCell
                        amount={r.dealValue}
                        frequency={r.dealFrequency}
                        align="right"
                        className="shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {workMore > 0 ? (
              <Link
                href={workHref(workFilter)}
                className="block px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-raised border-t border-border"
              >
                And {workMore} more in Work
              </Link>
            ) : null}
          </Panel>
        ) : null}
      </section>

      {books}

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
          Firm
        </h3>
        <p className="text-[13px] text-text-secondary tabular-nums">
          <Link href="/app/hr" className="hover:text-text-primary transition-colors">
            {data.activePeople} people
          </Link>
          <span className="text-text-muted"> · </span>
          <Link
            href={workPaths.clients}
            className="hover:text-text-primary transition-colors"
          >
            {data.liveProjects} live
          </Link>
          <span className="text-text-muted"> · </span>
          <Link href="/app/crm" className="hover:text-text-primary transition-colors">
            {data.companyClients} clients
            <span className="text-text-muted">
              {" "}
              · {data.companyProspects} prospects
            </span>
          </Link>
        </p>
      </section>
    </div>
  );
}
