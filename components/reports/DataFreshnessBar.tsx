"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  computeProjectFreshness,
  formatAsOf,
  relativeAge,
  type FreshnessConnection,
  type FreshnessStream,
  type TabChip,
} from "@/lib/reports/freshness";

interface DataFreshnessBarProps {
  streams: FreshnessStream[];
  connections?: FreshnessConnection[];
  projectId: string;
  isStaff?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onSyncProvider?: (provider: string) => void;
}

export function DataFreshnessBar({
  streams,
  connections = [],
  projectId,
  isStaff = false,
  refreshing = false,
  onRefresh,
  onSyncProvider,
}: DataFreshnessBarProps) {
  const freshness = computeProjectFreshness(streams, connections);
  if (!streams.length && !connections.length) return null;

  return (
    <div className="sticky top-0 z-20 mb-4 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Data as of
          </p>
          <p className="text-[14px] font-semibold text-gray-900">
            {formatAsOf(freshness.asOf)}
          </p>
        </div>
        {isStaff && onRefresh ? (
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-black disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        ) : null}
      </div>

      {freshness.syncErrors.map((err) => (
        <div
          key={err.tab}
          className="mt-2 inline-flex items-start gap-2 text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Sync failed — {err.tab} still showing {err.asOf ? relativeAge(err.asOf) : "older data"}.{" "}
            {err.message}
          </span>
        </div>
      ))}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {freshness.tabs.map((chip) => (
          <FreshnessChip
            key={chip.tab}
            chip={chip}
            projectId={projectId}
            isStaff={isStaff}
            onSyncProvider={onSyncProvider}
          />
        ))}
      </div>
    </div>
  );
}

function FreshnessChip({
  chip,
  projectId,
  isStaff,
  onSyncProvider,
}: {
  chip: TabChip;
  projectId: string;
  isStaff: boolean;
  onSyncProvider?: (provider: string) => void;
}) {
  const tone =
    chip.kind === "empty"
      ? "bg-gray-50 text-gray-400 border-gray-200"
      : chip.kind === "live"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : chip.kind === "mixed"
          ? "bg-sky-50 text-sky-800 border-sky-200"
          : "bg-amber-50 text-amber-900 border-amber-200";

  const body = (
    <>
      <span className="font-semibold">{chip.tab}</span>
      <span className="opacity-70">·</span>
      <span>{chip.kind === "empty" ? "No data" : chip.label}</span>
      {chip.detail ? (
        <>
          <span className="opacity-70">·</span>
          <span>{chip.detail}</span>
        </>
      ) : null}
    </>
  );

  if (!isStaff || chip.kind === "empty") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${tone}`}>
        {body}
      </span>
    );
  }

  if (chip.kind === "live" || chip.kind === "mixed") {
    return (
      <button
        type="button"
        onClick={() => chip.provider && onSyncProvider?.(chip.provider)}
        className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${tone} hover:brightness-95`}
      >
        {body}
      </button>
    );
  }

  const highlight = chip.subcategory || chip.tab.toLowerCase();
  return (
    <Link
      href={`/app/projects/report-data?project=${projectId}&highlight=${encodeURIComponent(highlight)}`}
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${tone} hover:brightness-95`}
    >
      {body}
    </Link>
  );
}
