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
  return ["lead", "prospect", "proposal", "final_nego", "agreement"].includes(status);
}

export function isIdentifiedStatus(status: string): boolean {
  return ["proposal", "final_nego", "agreement", "accepted"].includes(status);
}
