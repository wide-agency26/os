import type { BdStage, BdSource, BdLegitimacyStatus } from "./types";

/** Legacy prospect statuses (CSV import / older BD tooling). */
export const PROSPECT_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "proposal", label: "Proposal" },
  { value: "final_nego", label: "Final Nego" },
  { value: "agreement", label: "Agreement" },
  { value: "accepted", label: "Accepted" },
  { value: "lost", label: "Lost" },
] as const;

export const PARTNERSHIP_STATUSES = [
  { value: "exploring", label: "Exploring" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
] as const;

export const TASK_STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
] as const;

export const JOURNEY_ORDER = [
  "lead",
  "prospect",
  "proposal",
  "final_nego",
  "agreement",
  "accepted",
] as const;

export function statusLabel(status: string): string {
  return PROSPECT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function isPipelineStatus(status: string): boolean {
  return ["lead", "prospect", "proposal", "final_nego", "agreement"].includes(
    status
  );
}

export const BD_MAIN_STAGES: {
  id: BdStage;
  label: string;
}[] = [
  { id: "prospect", label: "Prospect" },
  { id: "qualifying", label: "Qualifying" },
  { id: "qualified_lead", label: "Qualified Lead" },
  { id: "outreach", label: "Outreach" },
  { id: "discovery_call", label: "Discovery Call" },
  { id: "proposal_sent", label: "Proposal Sent" },
  { id: "contract", label: "Contract" },
  { id: "quotation", label: "Quotation" },
  { id: "client_won", label: "Client / Won" },
];

export const BD_SIDE_LANES: {
  id: BdStage;
  label: string;
}[] = [
  { id: "on_hold", label: "On Hold" },
  { id: "declined", label: "Declined" },
  { id: "archived", label: "Archived" },
];

export const BD_ALL_STAGES: BdStage[] = [
  ...BD_MAIN_STAGES.map((s) => s.id),
  ...BD_SIDE_LANES.map((s) => s.id),
];

export const BD_STAGE_LABELS: Record<BdStage, string> = Object.fromEntries(
  [...BD_MAIN_STAGES, ...BD_SIDE_LANES].map((s) => [s.id, s.label])
) as Record<BdStage, string>;

export const BD_SOURCE_LABELS: Record<BdSource, string> = {
  manual: "Manual",
  auto_discovered: "Auto-discovered",
};

export const BD_LEGITIMACY_LABELS: Record<BdLegitimacyStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  uncertain: "Uncertain",
};

export function daysInStage(stageEnteredAt: string, now = new Date()): number {
  const start = new Date(stageEnteredAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const ms = Math.max(0, now.getTime() - start);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function isBdStage(value: string): value is BdStage {
  return (BD_ALL_STAGES as string[]).includes(value);
}
