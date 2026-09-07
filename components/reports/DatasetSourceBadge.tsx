"use client";

import { AlertTriangle, FileSpreadsheet, RefreshCw } from "lucide-react";
import { formatUploadedAt } from "@/lib/reports/ga4-website";
import {
  isFileStale,
  isLiveStale,
  relativeAge,
} from "@/lib/reports/freshness";
import Link from "next/link";

export const DATASET_STALE_DAYS = 30;

export interface DatasetSourceInfo {
  name?: string;
  createdAt?: string | null;
  rowCount?: number;
  sourceType?: string | null;
  syncedAt?: string | null;
  externalAccountLabel?: string | null;
  providerLabel?: string | null;
}

export function isDatasetStale(
  createdAt?: string | null,
  staleDays = DATASET_STALE_DAYS
): boolean {
  return isFileStale(createdAt, staleDays);
}

export function datasetAgeLabel(createdAt?: string | null): string | null {
  if (!createdAt) return null;
  return relativeAge(createdAt);
}

interface DatasetSourceBadgeProps {
  meta?: DatasetSourceInfo | null;
  channelLabel?: string;
  channelClassName?: string;
  className?: string;
  staleDays?: number;
  projectId?: string;
  isStaff?: boolean;
  onSync?: () => void;
}

export function DatasetSourceBadge({
  meta,
  channelLabel,
  channelClassName = "bg-blue-50 text-blue-700",
  className = "",
  staleDays = DATASET_STALE_DAYS,
  projectId,
  isStaff = false,
  onSync,
}: DatasetSourceBadgeProps) {
  if (!meta?.name && !meta?.createdAt && !meta?.syncedAt) return null;

  const live = meta?.sourceType === "sync";
  const asOf = meta?.syncedAt || meta?.createdAt;
  const stale = live ? isLiveStale(asOf, 24) : isFileStale(asOf, staleDays);
  const age = asOf ? relativeAge(asOf) : null;
  const sourceLine = live
    ? `Synced from ${meta?.providerLabel || meta?.externalAccountLabel || meta?.name || "live source"}`
    : `Uploaded file`;
  const account = live && meta?.externalAccountLabel ? ` (${meta.externalAccountLabel})` : "";

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-gray-600">
        <FileSpreadsheet size={13} className="text-slate-500 shrink-0" />
        <span className="min-w-0 break-words">
          <strong className="text-gray-800">
            {sourceLine}
            {account}
          </strong>
          <span className="text-gray-300 mx-1.5">|</span>
          <span className="text-gray-500">{live ? "Synced" : "Uploaded"}:</span>{" "}
          <strong className="text-gray-800">{formatUploadedAt(asOf)}</strong>
          {age ? <span className="text-gray-400"> ({age})</span> : null}
        </span>
        {channelLabel ? (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${channelClassName}`}
          >
            {channelLabel}
          </span>
        ) : null}
      </div>
      {stale && (
        <div className="inline-flex items-start gap-2 text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <span>
            {live ? (
              <>
                <strong className="font-semibold">Needs sync.</strong> Last update was {age}.{" "}
                {isStaff && onSync ? (
                  <button type="button" onClick={onSync} className="underline font-medium inline-flex items-center gap-1">
                    <RefreshCw size={11} /> Sync now
                  </button>
                ) : (
                  "Ask your agency to refresh."
                )}
              </>
            ) : (
              <>
                <strong className="font-semibold">Needs refresh.</strong> This file is {age}.{" "}
                {isStaff && projectId ? (
                  <Link
                    href={`/app/projects/report-data?project=${projectId}`}
                    className="underline font-medium"
                  >
                    Replace in Sources
                  </Link>
                ) : (
                  "Ask your agency to replace the file."
                )}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
