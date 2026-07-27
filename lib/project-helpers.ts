export type MilestoneRow = {
  phase: string;
  status: "completed" | "active" | "upcoming" | "awaiting_client";
  dates: string;
  /** ISO date — client approval / feedback pending since */
  awaiting_client_since?: string;
  /** e.g. "Wireframes" */
  approval_label?: string;
};

export type DeliverableRow = {
  name: string;
  done: boolean;
};

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** When DB has no milestones JSON, split the project window into four phases. */
export function milestonesFromDateRange(
  startDate: string | null,
  endDate: string | null
): MilestoneRow[] {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [];
  }
  const labels = ["Discovery & alignment", "Strategy & direction", "Design execution", "Refinement & delivery"];
  const total = end.getTime() - start.getTime();
  const now = Date.now();
  const quarter = total / 4;
  const phases: MilestoneRow[] = [];
  for (let i = 0; i < 4; i++) {
    const qStart = new Date(start.getTime() + quarter * i);
    const qEnd = new Date(start.getTime() + quarter * (i + 1) - 86400000);
    const rangeLabel = `${fmt(qStart)} – ${fmt(qEnd)}`;
    let status: MilestoneRow["status"] = "upcoming";
    if (now >= qEnd.getTime()) status = "completed";
    else if (now >= qStart.getTime()) status = "active";
    phases.push({ phase: labels[i] ?? `Phase ${i + 1}`, status, dates: rangeLabel });
  }
  return phases;
}

export function projectProgressPercent(
  startDate: string | null,
  endDate: string | null
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const t = (Date.now() - start) / (end - start);
  return Math.max(0, Math.min(100, Math.round(t * 100)));
}

export function daysElapsedInRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return { elapsed: 0, total: 0 };
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { elapsed: 0, total: 0 };
  const total = Math.ceil((end - start) / 86400000);
  const elapsed = Math.max(0, Math.ceil((Math.min(Date.now(), end) - start) / 86400000));
  return { elapsed, total };
}

export function parseMilestonesJson(raw: unknown): MilestoneRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MilestoneRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.phase !== "string" || typeof o.dates !== "string") continue;
    const st = o.status;
    if (
      st !== "completed" &&
      st !== "active" &&
      st !== "upcoming" &&
      st !== "awaiting_client"
    ) {
      continue;
    }
    const awaiting =
      typeof o.awaiting_client_since === "string" ? o.awaiting_client_since : undefined;
    const approval = typeof o.approval_label === "string" ? o.approval_label : undefined;
    out.push({
      phase: o.phase,
      dates: o.dates,
      status: st,
      awaiting_client_since: awaiting,
      approval_label: approval,
    });
  }
  return out.length ? out : null;
}

export function parseDeliverablesJson(raw: unknown): DeliverableRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliverableRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.name !== "string") continue;
    out.push({ name: o.name, done: Boolean(o.done) });
  }
  return out;
}
