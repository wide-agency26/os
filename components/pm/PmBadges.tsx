"use client";

import { PM_ICONS } from "@/lib/pm/icons";
import { daysSince, isStale, type PmTaskStatus } from "@/lib/pm/types";

const STATUS_LABEL: Record<PmTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export function TaskStatusBadge({ status }: { status: PmTaskStatus }) {
  const tones: Record<PmTaskStatus, string> = {
    todo: "bg-gray-100 text-gray-700",
    in_progress: "bg-sky-50 text-sky-800",
    blocked: "bg-amber-50 text-amber-900",
    done: "bg-emerald-50 text-emerald-800",
    cancelled: "bg-gray-50 text-gray-400",
  };
  return (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded ${tones[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function GateIcon({ cleared }: { cleared?: boolean }) {
  const Icon = cleared ? PM_ICONS.gateCleared : PM_ICONS.gate;
  return (
    <Icon
      className={`w-3.5 h-3.5 shrink-0 ${cleared ? "text-emerald-600" : "text-amber-700"}`}
      aria-label={cleared ? "Gate cleared" : "Gate / blocked"}
    />
  );
}

export function RecurringIcon() {
  const Icon = PM_ICONS.recurring;
  return <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-label="Recurring" />;
}

export function StaleBadge({
  lastActivityAt,
  staleAfterDays = 7,
}: {
  lastActivityAt: string | null | undefined;
  staleAfterDays?: number;
}) {
  if (!isStale(lastActivityAt, staleAfterDays)) return null;
  const days = daysSince(lastActivityAt);
  const Icon = PM_ICONS.stale;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded"
      title={`No activity for ${days} days`}
    >
      <Icon className="w-3.5 h-3.5" />
      {days}d stale
    </span>
  );
}

export function EmailSourceIcon() {
  const Icon = PM_ICONS.fromEmail;
  return <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-label="From email" />;
}

export function ReviewQueueBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const Icon = PM_ICONS.pendingReview;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded">
      <Icon className="w-3.5 h-3.5" />
      {count} to review
    </span>
  );
}
