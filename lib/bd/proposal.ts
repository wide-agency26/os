export type BdProposalType = "sow" | "slides";

export type BdProposalStatus =
  | "draft"
  | "published"
  | "accepted"
  | "declined"
  | "on_hold"
  | "archived";

export type BdProposalPayload = {
  type: BdProposalType | null;
  linked_id: string | null;
  status: BdProposalStatus | null;
  title: string | null;
  updated_at: string | null;
};

export function emptyProposal(): BdProposalPayload {
  return {
    type: null,
    linked_id: null,
    status: null,
    title: null,
    updated_at: null,
  };
}

export function mergeProposal(
  raw: Record<string, unknown> | null | undefined
): BdProposalPayload {
  const base = emptyProposal();
  if (!raw) return base;
  const type =
    raw.type === "sow" || raw.type === "slides" ? raw.type : null;
  const status =
    typeof raw.status === "string" ? (raw.status as BdProposalStatus) : null;
  return {
    type,
    linked_id: typeof raw.linked_id === "string" ? raw.linked_id : null,
    status,
    title: typeof raw.title === "string" ? raw.title : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export function buildProposalPayload(input: {
  type: BdProposalType;
  linkedId: string;
  status: BdProposalStatus;
  title?: string | null;
}): BdProposalPayload {
  return {
    type: input.type,
    linked_id: input.linkedId,
    status: input.status,
    title: input.title ?? null,
    updated_at: new Date().toISOString(),
  };
}
