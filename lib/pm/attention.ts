import { daysSince, isStale } from "@/lib/pm/types";

/** Client/project attention signals — same vocabulary as §5 icons + Clients filters. */
export type AttentionSignal =
  | "blocked"
  | "stale"
  | "pending_review"
  | "on_track";

export const ATTENTION_LABELS: Record<AttentionSignal, string> = {
  blocked: "Blocked / gate",
  stale: "Stale",
  pending_review: "Pending review",
  on_track: "On track",
};

/** Higher = worse for rollup / sort. */
export const ATTENTION_SEVERITY: Record<AttentionSignal, number> = {
  blocked: 3,
  stale: 2,
  pending_review: 1,
  on_track: 0,
};

export type ProjectAttentionInput = {
  id: string;
  clientId: string | null;
  status?: string | null;
  lastActivityAt: string | null;
  hasOpenGate: boolean;
  pendingReviewCount: number;
  hasOpenPmTasks: boolean;
};

export function projectAttentionSignal(
  project: ProjectAttentionInput,
  staleAfterDays: number
): AttentionSignal {
  if (project.hasOpenGate) return "blocked";
  if (
    project.hasOpenPmTasks &&
    isStale(project.lastActivityAt, staleAfterDays)
  ) {
    return "stale";
  }
  // No activity ever but has open tasks → treat as stale if we have no timestamp
  if (
    project.hasOpenPmTasks &&
    !project.lastActivityAt &&
    staleAfterDays >= 0
  ) {
    return "stale";
  }
  if (project.pendingReviewCount > 0) return "pending_review";
  return "on_track";
}

export function worstAttention(
  signals: AttentionSignal[]
): AttentionSignal {
  if (!signals.length) return "on_track";
  return signals.reduce((worst, s) =>
    ATTENTION_SEVERITY[s] > ATTENTION_SEVERITY[worst] ? s : worst
  );
}

export function needsAttention(signal: AttentionSignal): boolean {
  return signal !== "on_track";
}

export type ActivityEventType =
  | "task_completed"
  | "gate_cleared"
  | "pending_review"
  | "cycle_regenerated";

export const ACTIVITY_LABELS: Record<ActivityEventType, string> = {
  task_completed: "Task completed",
  gate_cleared: "Gate cleared",
  pending_review: "Pending review",
  cycle_regenerated: "Cycle regenerated",
};

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  at: string;
  title: string;
  projectId: string;
  projectTitle: string;
  clientId: string | null;
  clientLabel: string;
};

export function formatUpdatedAgo(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = daysSince(iso);
  return d != null ? `${d}d ago` : "—";
}

/** Infer package family from CRM services_package checklist for intake chart grouping. */
export function packageFamilyFromServices(
  servicesPackage: unknown
): "MVB" | "Startup Launch" | "Growth Program" | "Full-Service" | "Other" {
  const list = Array.isArray(servicesPackage)
    ? servicesPackage.map(String)
    : [];
  const joined = list.join(" ").toLowerCase();
  if (joined.includes("full-service") || joined.includes("full service")) {
    return "Full-Service";
  }
  if (joined.includes("growth program")) return "Growth Program";
  if (joined.includes("startup launch")) return "Startup Launch";
  if (joined.includes("[package] mvb") || /\bmvb\b/.test(joined)) return "MVB";
  return "Other";
}
