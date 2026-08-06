"use client";

import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import { formatUploadedAt } from "@/lib/reports/ga4-website";

/** Datasets older than this (days) show a “needs refresh” badge */
export const DATASET_STALE_DAYS = 30;

export interface DatasetSourceInfo {
  name?: string;
  createdAt?: string | null;
  rowCount?: number;
}

export function isDatasetStale(
  createdAt?: string | null,
  staleDays = DATASET_STALE_DAYS
): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (isNaN(t)) return false;
  const ageMs = Date.now() - t;
  return ageMs > staleDays * 24 * 60 * 60 * 1000;
}

export function datasetAgeLabel(createdAt?: string | null): string | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

interface DatasetSourceBadgeProps {
  meta?: DatasetSourceInfo | null;
  /** Optional channel chip e.g. "Ads · Meta" */
  channelLabel?: string;
  channelClassName?: string;
  className?: string;
  staleDays?: number;
}

/**
 * Standardized provenance line:
 * Data Source: [name] | Uploaded On: [date]  (+ stale refresh badge when old)
 */
export function DatasetSourceBadge({
  meta,
  channelLabel,
  channelClassName = "bg-blue-50 text-blue-700",
  className = "",
  staleDays = DATASET_STALE_DAYS,
}: DatasetSourceBadgeProps) {
  if (!meta?.name && !meta?.createdAt) return null;

  const stale = isDatasetStale(meta?.createdAt, staleDays);
  const age = datasetAgeLabel(meta?.createdAt);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-gray-600">
        <FileSpreadsheet size={13} className="text-indigo-500 shrink-0" />
        <span className="min-w-0 break-words">
          <span className="text-gray-500">Data Source:</span>{" "}
          <strong className="text-gray-800">{meta?.name || "Untitled dataset"}</strong>
          <span className="text-gray-300 mx-1.5">|</span>
          <span className="text-gray-500">Uploaded On:</span>{" "}
          <strong className="text-gray-800">{formatUploadedAt(meta?.createdAt)}</strong>
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
            <strong className="font-semibold">Needs refresh.</strong> This dataset was uploaded{" "}
            {age || "a while ago"}. Re-export from the source and upload a fresh CSV in the Data
            Hub so reports stay accurate.
          </span>
        </div>
      )}
    </div>
  );
}
