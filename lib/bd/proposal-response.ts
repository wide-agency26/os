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
