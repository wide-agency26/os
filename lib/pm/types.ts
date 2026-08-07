export type PmTaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export type TaskTemplateRow = {
  id: string;
  service_playbook_id: string;
  title: string;
  description: string | null;
  deliverable: string | null;
  default_role: string;
  estimated_duration_hours: number | null;
  is_gate: boolean;
  depends_on: string | null;
  phase_label: string | null;
  recurs: boolean;
  sort_order: number;
};

export type PmTaskRow = {
  id: string;
  project_id: string;
  task_template_id: string | null;
  title: string;
  description: string | null;
  /** BlockNote document JSON; description stays a plain-text summary. */
  content_blocks?: unknown | null;
  assignee_id: string | null;
  default_role: string | null;
  status: PmTaskStatus;
  is_gate: boolean;
  depends_on: string | null;
  phase_label: string | null;
  source: "manual" | "template" | "email";
  source_ref: string | null;
  cycle_key: string | null;
  estimated_duration_hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  sort_order: number;
};

export function currentCycleKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function nextCycleKey(cycleKey: string): string {
  const [y, m] = cycleKey.split("-").map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return currentCycleKey(d);
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export function isStale(
  lastActivityAt: string | null | undefined,
  staleAfterDays = 7
): boolean {
  const d = daysSince(lastActivityAt);
  return d !== null && d >= staleAfterDays;
}
