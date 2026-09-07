"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar as CalendarIcon, List, X } from "lucide-react";
import {
  aggregateMonthly,
  entryCompanyName,
  entryDealLabel,
  entryProject,
  groupByCategory,
  groupByProjectOrSource,
} from "@/lib/accounting/queries";
import {
  formatEuro,
  isAutoSource,
  LEDGER_PILLAR_UI,
  stagePillarLabel,
  type LedgerEntry,
  type LedgerPillar,
} from "@/lib/accounting/types";
import { workPaths } from "@/lib/work/paths";

type ViewMode = "calendar" | "table";
type TypeView = "revenue" | "cost" | "both";

const PILLAR_HREF: Record<LedgerPillar, string> = {
  actual: "/app/accounting/actual",
  identified: "/app/accounting/identified",
  unidentified: "/app/accounting/unidentified",
};

export function LedgerBrowseView({
  pillar,
  entries,
  onClose,
}: {
  pillar: LedgerPillar;
  entries: LedgerEntry[];
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [typeView, setTypeView] = useState<TypeView>("both");
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const viewEntries = useMemo(
    () =>
      typeView === "both"
        ? entries
        : entries.filter((e) => e.type === typeView),
    [entries, typeView]
  );
  const monthly = useMemo(() => aggregateMonthly(viewEntries), [viewEntries]);
  const groups = useMemo(
    () =>
      pillar === "unidentified"
        ? groupByCategory(viewEntries)
        : groupByProjectOrSource(viewEntries),
    [viewEntries, pillar]
  );
  const entriesByMonth = useMemo(() => {
    const map = new Map<number, LedgerEntry[]>();
    for (const e of viewEntries) {
      if (!e.entry_date) continue;
      const m = Number(e.entry_date.slice(5, 7));
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(e);
    }
    return map;
  }, [viewEntries]);
  const maxMonthVal = Math.max(
    1,
    ...monthly.flatMap((m) => [m.revenue, m.cost])
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[13px] font-semibold text-gray-900">
            {LEDGER_PILLAR_UI[pillar].title}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            View only. Open the full ledger to adjust.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CalendarIcon size={13} /> Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List size={13} /> Table
            </button>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            {(["revenue", "cost", "both"] as TypeView[]).map((tv) => (
              <button
                key={tv}
                type="button"
                onClick={() => setTypeView(tv)}
                className={`px-3 py-1.5 rounded text-[12px] font-medium capitalize transition-colors ${
                  typeView === tv
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tv === "revenue" ? "In" : tv === "cost" ? "Out" : "Both"}
              </button>
            ))}
          </div>
          <Link
            href={PILLAR_HREF[pillar]}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-700 hover:text-gray-950"
          >
            Open full {LEDGER_PILLAR_UI[pillar].title} ledger
            <ArrowRight size={12} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {viewMode === "calendar" ? (
          <div className="space-y-3">
            {viewEntries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Nothing in this range.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {monthly.map((m) => {
                    const monthEntries = entriesByMonth.get(m.month) || [];
                    const isOpen = expandedMonth === m.month;
                    const net = m.revenue - m.cost;
                    return (
                      <button
                        key={m.month}
                        type="button"
                        onClick={() =>
                          setExpandedMonth(isOpen ? null : m.month)
                        }
                        className={`rounded-lg border bg-white text-left px-3 py-2.5 transition-colors ${
                          isOpen
                            ? "border-gray-950 ring-1 ring-gray-950"
                            : monthEntries.length
                              ? "border-gray-300 hover:border-gray-400"
                              : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold text-gray-900">
                            {m.label}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {monthEntries.length} entries
                          </span>
                        </div>
                        {monthEntries.length > 0 && (
                          <p className="mt-1 text-[10px] text-gray-500 truncate">
                            {[...new Set(monthEntries.map(entryDealLabel))]
                              .slice(0, 2)
                              .join(" · ")}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-end gap-1 h-10">
                          <div
                            className="w-2 rounded-sm bg-gray-900/80"
                            style={{
                              height: `${Math.max(2, (m.revenue / maxMonthVal) * 100)}%`,
                            }}
                          />
                          <div
                            className="w-2 rounded-sm bg-gray-400/80"
                            style={{
                              height: `${Math.max(2, (m.cost / maxMonthVal) * 100)}%`,
                            }}
                          />
                          <div className="flex-1 text-right">
                            <p className="text-[12px] font-semibold text-gray-900 tabular-nums">
                              {formatEuro(net)}
                            </p>
                            <p className="text-[10px] text-gray-400">net</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {expandedMonth != null && (
                  <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {monthly.find((m) => m.month === expandedMonth)?.label}
                    </p>
                    {(entriesByMonth.get(expandedMonth) || []).length === 0 ? (
                      <p className="p-3 text-[12px] text-gray-400">
                        No entries this month.
                      </p>
                    ) : (
                      (entriesByMonth.get(expandedMonth) || []).map((entry) => (
                        <BrowseRow key={entry.id} entry={entry} />
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Nothing in this range.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const isOpen = expandedGroups[group.key] ?? true;
              return (
                <div
                  key={group.key}
                  className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.key]: !isOpen,
                      }))
                    }
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {group.badge}
                      </span>
                      {group.key.startsWith("project:") ? (
                        <Link
                          href={`/app/projects/${group.key.slice(8)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[13px] font-semibold text-gray-900 hover:underline truncate"
                        >
                          {group.label}
                        </Link>
                      ) : group.key.startsWith("crm:") &&
                        group.entries[0]?.company_id ? (
                        <Link
                          href={workPaths.company(group.entries[0].company_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[13px] font-semibold text-gray-900 hover:underline truncate"
                        >
                          {group.label}
                        </Link>
                      ) : (
                        <span className="text-[13px] font-semibold text-gray-900 truncate">
                          {group.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[12px] shrink-0">
                      {group.revenue > 0 && (
                        <span className="text-gray-900 tabular-nums">
                          +{formatEuro(group.revenue)}
                        </span>
                      )}
                      {group.cost > 0 && (
                        <span className="text-gray-500 tabular-nums">
                          −{formatEuro(group.cost)}
                        </span>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {group.entries.map((entry) => (
                        <BrowseRow key={entry.id} entry={entry} showDate />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BrowseRow({
  entry,
  showDate,
}: {
  entry: LedgerEntry;
  showDate?: boolean;
}) {
  const auto = isAutoSource(entry.source);
  const project = entryProject(entry);
  const companyName = entryCompanyName(entry);
  const companyHref = entry.company_id
    ? workPaths.company(entry.company_id)
    : null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-800 truncate">
            {entry.category || "Untitled"}
          </span>
          {auto ? (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
              auto
            </span>
          ) : (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
              manual
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
          {project ? (
            <Link
              href={`/app/projects/${project.id}`}
              className="font-medium text-gray-800 hover:underline"
            >
              {project.title || "Project"}
            </Link>
          ) : null}
          {companyHref ? (
            <Link
              href={companyHref}
              className="font-medium text-gray-800 hover:underline"
            >
              {companyName || "Work"}
            </Link>
          ) : null}
          {entry.projects?.stage || project?.stage ? (
            <span>
              {stagePillarLabel(project?.stage || entry.projects?.stage)}
            </span>
          ) : entry.source === "auto_crm" ? (
            <span>Unidentified</span>
          ) : null}
        </p>
        {showDate && entry.entry_date && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {new Date(entry.entry_date).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
      <span
        className={`tabular-nums font-medium shrink-0 ${
          entry.type === "revenue" ? "text-gray-900" : "text-gray-500"
        }`}
      >
        {entry.type === "revenue" ? "+" : "−"}
        {formatEuro(entry.amount)}
      </span>
    </div>
  );
}
