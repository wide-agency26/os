export const BD_DECLINE_REASONS = [
  "Budget",
  "Timing not right",
  "Chose another agency",
  "Scope doesn't match our needs",
  "Going in-house",
  "Project on pause",
  "Other",
] as const;

export type BdDeclineReason = (typeof BD_DECLINE_REASONS)[number];

export type BdProposalDecision = "accept" | "decline" | "hold";

export function publicProposalDisabledReason(
  status: string | null | undefined
): string | null {
  if (status === "accepted") return "This proposal is already marked accepted.";
  if (status === "on_hold" || status === "hold") {
    return "This proposal is already marked on hold.";
  }
  if (status === "declined") return "This proposal is already marked declined.";
  return null;
}
