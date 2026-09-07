"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, Eye } from "lucide-react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PageHeader, buttonClass } from "@/components/frappe-ui/primitives";
import { BdBoard } from "@/components/bd/BdBoard";
import type { BdRecord, BdStaffOption } from "@/lib/bd/types";
import type { WorkHubRow } from "@/lib/work/load-hub";
import {
  WORK_GROUP_LABELS,
  workGroupForBdCard,
  type WorkGroup,
} from "@/lib/work/stages";
import { workPaths } from "@/lib/work/paths";
import { workRowHref, type WorkNavContext } from "@/lib/work/navigation";
import { CompanyLogoMark } from "@/components/crm/CompanyLogo";
import { MONTH_SHORT } from "@/lib/accounting/types";
import { OfferingChips } from "@/components/offerings/OfferingChips";
import { DealAmountCell } from "@/components/work/DealAmountCell";

type HubFilter =
  | "active"
  | "win"
  | "prospecting"
  | "lead"
  | "archive"
  | "clients"
  | WorkGroup;

const STAGE_STRIP: { key: HubFilter; label: string; groups: WorkGroup[] }[] = [
  { key: "prospecting", label: "Prospecting", groups: ["find", "qualify"] },
  { key: "lead", label: "Lead", groups: ["propose", "contract"] },
  { key: "live", label: "Clients", groups: ["live"] },
  { key: "archive", label: "Archive", groups: ["done", "lose"] },
];

function matchesFilter(group: WorkGroup, filter: HubFilter): boolean {
  if (filter === "active") return group !== "lose" && group !== "done";
  if (filter === "prospecting") return group === "find" || group === "qualify";
  if (filter === "lead" || filter === "win") {
    return group === "propose" || group === "contract";
  }
  if (filter === "archive") return group === "done" || group === "lose";
  if (filter === "clients") return group === "live";
  return group === filter;
}

function stripIsActive(filter: HubFilter, key: HubFilter): boolean {
  if (key === "prospecting") {
    return filter === "prospecting" || filter === "find" || filter === "qualify";
  }
  if (key === "lead") {
    return (
      filter === "lead" ||
      filter === "win" ||
      filter === "propose" ||
      filter === "contract"
    );
  }
  if (key === "live") return filter === "live" || filter === "clients";
  if (key === "archive") {
    return filter === "archive" || filter === "done" || filter === "lose";
  }
  return filter === key;
}

function formatStart(iso: string | null) {
  if (!iso || iso.length < 7) return "—";
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  if (!m || m < 1 || m > 12) return iso.slice(0, 10);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

export function WorkHub({
  rows,
  records,
  staff,
  currentUserId,
  navContext = "full",
  basePath = "/app/work",
  title = "Work",
  subtitle = "Full pipeline — projects and deals across every stage.",
  showStageStrip = true,
  defaultFilter = "active",
  hideViewToggle = false,
  tools,
}: {
  rows: WorkHubRow[];
  records: BdRecord[];
  staff: BdStaffOption[];
  currentUserId: string;
  navContext?: WorkNavContext;
  basePath?: string;
  title?: string;
  subtitle?: string;
  showStageStrip?: boolean;
  defaultFilter?: HubFilter;
  hideViewToggle?: boolean;
  tools?: React.ReactNode;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const view = search.get("view") === "board" ? "board" : "list";
  const highlight = search.get("highlight");
  const filter = (search.get("filter") || defaultFilter) as HubFilter;

  const counts = useMemo(() => {
    const c: Record<WorkGroup, number> = {
      find: 0,
      qualify: 0,
      propose: 0,
      contract: 0,
      live: 0,
      done: 0,
      lose: 0,
    };
    for (const r of rows) c[r.group] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(
    () => rows.filter((r) => matchesFilter(r.group, filter)),
    [rows, filter]
  );

  useEffect(() => {
    if (!highlight || view !== "list") return;
    const el = document.getElementById(`work-row-${highlight}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight, view, visible]);

  function setParams(next: { view?: string; filter?: string }) {
    const q = new URLSearchParams(search.toString());
    if (next.view) q.set("view", next.view);
    if (next.filter) q.set("filter", next.filter);
    if (next.view === "list") q.delete("view");
    router.push(`${basePath}?${q.toString()}`.replace(/\?$/, ""));
  }
  const boardRecords = useMemo(() => {
    return records.filter((r) => {
      const g = workGroupForBdCard({
        stage: r.stage,
        projectStage: r.project_stage,
        projectStatus: r.project_status,
      });
      return matchesFilter(g, filter);
    });
  }, [records, filter]);

  return (
    <Workspace wide>
      <div className="space-y-6">
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={
            hideViewToggle ? undefined : (
            <div className="inline-flex rounded-md border border-border p-0.5 bg-surface">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold ${
                  view === "list" ? "bg-accent text-white" : "text-text-secondary"
                }`}
                onClick={() => setParams({ view: "list" })}
              >
                <List size={14} strokeWidth={1.75} /> List
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold ${
                  view === "board" ? "bg-accent text-white" : "text-text-secondary"
                }`}
                onClick={() => setParams({ view: "board" })}
              >
                <LayoutGrid size={14} strokeWidth={1.75} /> Board
              </button>
            </div>
            )
          }
        />

        {tools}

        {showStageStrip ? (
        <div className="flex flex-wrap items-center gap-2">
          {STAGE_STRIP.map((stage, i) => {
            const count = stage.groups.reduce((sum, g) => sum + counts[g], 0);
            const active = stripIsActive(filter, stage.key);
            return (
              <span key={stage.key} className="inline-flex items-center gap-2">
                {i > 0 && <span className="text-text-muted text-xs">→</span>}
                <button
                  type="button"
                  onClick={() => setParams({ filter: stage.key })}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                    active
                      ? "bg-accent text-white"
                      : stage.key === "live"
                        ? "bg-accent/10 text-text-primary hover:bg-accent/15"
                        : "bg-surface-raised text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {stage.label}
                  <span className="ml-1 tabular-nums opacity-70">{count}</span>
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setParams({ filter: "active" })}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
              filter === "active"
                ? "bg-accent text-white"
                : "text-text-muted hover:bg-surface-raised"
            }`}
          >
            All active
          </button>
        </div>
        ) : null}

        {filter === "find" && navContext === "full" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-text-primary">Find</p>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Logged prospects live here. Run Prospect Finder to surface new names.
              </p>
            </div>
            <Link href={workPaths.findTool} className={buttonClass("primary")}>
              <Search size={14} strokeWidth={1.75} /> Prospect Finder
            </Link>
          </div>
        )}

        {(filter === "live" || filter === "clients") && navContext === "full" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-text-primary">Clients</p>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Live delivery work. Open a company to work it, or view the portal as they do.
              </p>
            </div>
            <Link href={workPaths.viewAs} className={buttonClass("primary")}>
              <Eye size={14} strokeWidth={1.75} /> View as client
            </Link>
          </div>
        )}

        {view === "board" ? (
          <BdBoard
            initialRecords={boardRecords}
            staff={staff}
            currentUserId={currentUserId}
            hideLoseLanes={filter !== "lose" && filter !== "archive"}
            qualifyOnly={filter === "qualify"}
            loseOnly={filter === "lose"}
            embedded
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-left text-[11px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">Stage</th>
                  <th className="px-4 py-2.5 font-semibold">Start</th>
                  <th className="px-4 py-2.5 font-semibold">Next</th>
                  <th className="px-4 py-2.5 font-semibold">€</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-text-secondary">
                      Nothing in this filter.
                    </td>
                  </tr>
                )}
                {visible.map((r) => (
                  <tr
                    key={r.projectId || r.companyId}
                    id={`work-row-${r.projectId || r.companyId}`}
                    aria-current={
                      highlight === r.companyId || highlight === r.projectId
                        ? "true"
                        : undefined
                    }
                    className={`cursor-pointer ${
                      highlight === r.companyId || highlight === r.projectId
                        ? "bg-surface-raised ring-2 ring-inset ring-accent"
                        : r.group === "live"
                          ? "bg-surface-raised/60 hover:bg-surface-raised border-l-2 border-l-accent"
                          : r.group === "lose"
                            ? "opacity-70 hover:bg-surface-raised/60"
                            : "hover:bg-surface-raised/60"
                    }`}
                    onClick={() => router.push(workRowHref(r, navContext))}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CompanyLogoMark
                          label={r.label}
                          logoUrl={r.logoUrl}
                          website={r.website}
                          size={28}
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-text-primary ${
                              r.group === "live" ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {r.projectTitle || r.label}
                          </p>
                          <p className="text-[11px] text-text-secondary">
                            {r.projectTitle && r.projectTitle !== r.label
                              ? r.label
                              : r.crmStatus || "Prospect"}
                            {r.projectTitle && r.projectTitle !== r.label
                              ? ` · ${r.crmStatus || "Prospect"}`
                              : ""}
                            {r.ownerName ? ` · ${r.ownerName}` : ""}
                          </p>
                          {(r.offerings?.length ?? 0) > 0 || r.projectId || r.bdRecordId ? (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              <OfferingChips
                                value={r.offerings ?? []}
                                projectId={r.projectId}
                                bdRecordId={r.bdRecordId}
                                compact
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          r.group === "lose"
                            ? "bg-red-50 text-danger"
                            : r.group === "done"
                              ? "bg-surface-raised text-text-muted"
                              : r.group === "live"
                                ? "bg-accent text-white"
                                : "bg-surface-raised text-text-secondary"
                        }`}
                      >
                        {WORK_GROUP_LABELS[r.group]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary tabular-nums whitespace-nowrap">
                      {formatStart(r.startDate)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {r.nextAction || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <DealAmountCell
                        amount={r.dealValue}
                        frequency={r.dealFrequency}
                      />
                      {r.pillarLabel && r.dealLabel ? (
                        <span className="block text-[10px] text-text-muted mt-0.5">
                          {r.pillarLabel}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Workspace>
  );
}
