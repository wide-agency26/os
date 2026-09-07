export type SowAssistAnswers = {
  services?: string;
  budgetBand?: string;
  timeline?: string;
  inOut?: string;
  tone?: "sharp" | "conservative";
};

export type SowSuggestion = {
  id: string;
  field: string;
  proposed: string;
  price?: number | null;
};

export type SowClientResponse = {
  decision: "accept" | "hold" | "decline";
  status: string;
  decided_at: string;
  decline_reason: string | null;
  decline_other_text: string | null;
};

export type SowAssistContext = {
  raw_text: string;
  notes: string[];
  bd_record_id: string | null;
  answers: SowAssistAnswers;
  pending_suggestions: SowSuggestion[];
  client_response: SowClientResponse | null;
  updated_at: string | null;
};

export type SowSectionMergeOrigin = {
  title: string;
  category: string;
  portrayal: string;
  intro: string | null;
  service_id: string | null;
  service_name_snapshot: string | null;
  service_description_snapshot: string | null;
  service_short_description_snapshot: string | null;
  sort_order: number;
  item_ids: string[];
};

export function emptySowAssistContext(): SowAssistContext {
  return {
    raw_text: "",
    notes: [],
    bd_record_id: null,
    answers: {},
    pending_suggestions: [],
    client_response: null,
    updated_at: null,
  };
}

export function mergeSowAssistContext(raw: unknown): SowAssistContext {
  const base = emptySowAssistContext();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    raw_text: typeof o.raw_text === "string" ? o.raw_text : base.raw_text,
    notes: Array.isArray(o.notes)
      ? o.notes.filter((n): n is string => typeof n === "string")
      : typeof o.raw_text === "string" && o.raw_text
        ? [o.raw_text]
        : [],
    bd_record_id:
      typeof o.bd_record_id === "string" ? o.bd_record_id : null,
    answers:
      o.answers && typeof o.answers === "object"
        ? (o.answers as SowAssistAnswers)
        : {},
    pending_suggestions: Array.isArray(o.pending_suggestions)
      ? (o.pending_suggestions as SowSuggestion[])
      : [],
    client_response: parseClientResponse(o.client_response),
    updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

function parseClientResponse(raw: unknown): SowClientResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const decision =
    o.decision === "accept" || o.decision === "hold" || o.decision === "decline"
      ? o.decision
      : null;
  if (!decision || typeof o.decided_at !== "string") return null;
  return {
    decision,
    status: typeof o.status === "string" ? o.status : decision,
    decided_at: o.decided_at,
    decline_reason: typeof o.decline_reason === "string" ? o.decline_reason : null,
    decline_other_text:
      typeof o.decline_other_text === "string" ? o.decline_other_text : null,
  };
}

export function suggestionFor(
  suggestions: SowSuggestion[],
  field: string
): SowSuggestion | undefined {
  return suggestions.find((s) => s.field === field);
}
