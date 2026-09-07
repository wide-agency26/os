export const OVERRIDE_TRIGGERS = [
  "factually_wrong",
  "wrong_tone",
  "missing_context",
  "policy",
  "preference",
] as const;

export type OverrideTrigger = (typeof OVERRIDE_TRIGGERS)[number];

export const OVERRIDE_OUTCOMES = [
  "accept",
  "edit",
  "replace",
  "regenerate",
  "block",
  "cosmetic",
  "augment",
] as const;

export type OverrideOutcome = (typeof OVERRIDE_OUTCOMES)[number];

export const OVERRIDE_TRIGGER_LABELS: Record<OverrideTrigger, string> = {
  factually_wrong: "Factually wrong",
  wrong_tone: "Wrong tone",
  missing_context: "Missing context",
  policy: "Policy",
  preference: "Preference",
};

export function isOverrideTrigger(value: string | null | undefined): value is OverrideTrigger {
  return (OVERRIDE_TRIGGERS as readonly string[]).includes(String(value || ""));
}

function lettersOnly(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function collapsed(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Typo / whitespace / punctuation only — not a substance override. */
export function isCosmeticEdit(from: string, to: string) {
  const a = from ?? "";
  const b = to ?? "";
  if (a === b) return false;
  if (collapsed(a) === collapsed(b)) return true;
  return lettersOnly(a) === lettersOnly(b);
}

export function classifyReviewOutcome(input: {
  originalTitle: string;
  originalDescription: string | null | undefined;
  nextTitle: string;
  nextDescription: string | null | undefined;
}): OverrideOutcome {
  const fromTitle = (input.originalTitle || "").trim();
  const toTitle = (input.nextTitle || "").trim();
  const fromDesc = (input.originalDescription || "").trim();
  const toDesc = (input.nextDescription || "").trim();

  if (fromTitle === toTitle && fromDesc === toDesc) return "accept";
  if (isCosmeticEdit(fromTitle, toTitle) && isCosmeticEdit(fromDesc, toDesc)) {
    return "cosmetic";
  }
  if (
    (fromTitle === toTitle || isCosmeticEdit(fromTitle, toTitle)) &&
    (fromDesc === toDesc || isCosmeticEdit(fromDesc, toDesc))
  ) {
    return "cosmetic";
  }
  return "edit";
}

export function reviewLatencySeconds(createdAt: string | null | undefined, reviewedAt = new Date()) {
  const start = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(start)) return null;
  return Math.max(0, Math.round((reviewedAt.getTime() - start) / 1000));
}

export const OVERRIDE_SURFACES = [
  "chat",
  "task",
  "email",
  "guideline",
  "ci_builder",
  "report",
  "content",
  "sow",
  "bd",
  "hr",
  "other",
] as const;

export type OverrideSurface = (typeof OVERRIDE_SURFACES)[number];

export const DAM_QUADRANTS = ["Q1", "Q2", "Q3", "Q4"] as const;
export type DamQuadrant = (typeof DAM_QUADRANTS)[number];

/** Outcomes that count toward the override numerator (not accept/cosmetic/augment). */
export function isOverrideNumerator(outcome: OverrideOutcome) {
  return (
    outcome === "edit" ||
    outcome === "replace" ||
    outcome === "regenerate" ||
    outcome === "block"
  );
}

export function isOverrideOutcome(value: string | null | undefined): value is OverrideOutcome {
  return (OVERRIDE_OUTCOMES as readonly string[]).includes(String(value || ""));
}

export function isOverrideSurface(value: string | null | undefined): value is OverrideSurface {
  return (OVERRIDE_SURFACES as readonly string[]).includes(String(value || ""));
}

export function isDamQuadrant(value: string | null | undefined): value is DamQuadrant {
  return (DAM_QUADRANTS as readonly string[]).includes(String(value || ""));
}

export type LogOverrideInput = {
  agent_key: string;
  outcome: OverrideOutcome;
  override_trigger?: OverrideTrigger | null;
  surface?: OverrideSurface;
  task_id?: string | null;
  project_id?: string | null;
  dam_quadrant?: DamQuadrant | null;
  dam_alpha?: 0 | 0.5 | 1 | null;
  proposed_summary?: string | null;
  final_summary?: string | null;
  latency_s?: number | null;
  reviewed_by_label?: string | null;
  /** ISO timestamp when the review happened (if logging later the same week). */
  occurred_at?: string | null;
  meta?: Record<string, unknown> | null;
};

function parseOccurredAt(value: string | null | undefined): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim();
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    return { error: "occurred_at must be a valid ISO timestamp." };
  }
  const now = Date.now();
  // Reject far-future clocks and dates clearly outside a thesis observation window.
  if (ms > now + 60 * 60 * 1000) {
    return { error: "occurred_at cannot be more than one hour in the future." };
  }
  if (ms < now - 60 * 24 * 60 * 60 * 1000) {
    return { error: "occurred_at cannot be older than 60 days." };
  }
  return new Date(ms).toISOString();
}

export function validateOverrideLog(
  input: LogOverrideInput
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const agent = String(input.agent_key || "").trim().slice(0, 80);
  if (!agent) return { ok: false, error: "agent_key is required (e.g. pm_bot)." };

  if (!isOverrideOutcome(input.outcome)) {
    return {
      ok: false,
      error: "outcome must be accept|edit|replace|regenerate|block|cosmetic|augment.",
    };
  }

  const surface = input.surface || "chat";
  if (!isOverrideSurface(surface)) {
    return { ok: false, error: `surface must be one of: ${OVERRIDE_SURFACES.join("|")}.` };
  }

  if (isOverrideNumerator(input.outcome) && !isOverrideTrigger(input.override_trigger)) {
    return {
      ok: false,
      error:
        "override_trigger required for edit|replace|regenerate|block: factually_wrong|wrong_tone|missing_context|policy|preference.",
    };
  }

  let alpha: number | null = null;
  if (input.dam_alpha !== undefined && input.dam_alpha !== null) {
    const a = Number(input.dam_alpha);
    if (![0, 0.5, 1].includes(a)) {
      return { ok: false, error: "dam_alpha must be 0 | 0.5 | 1." };
    }
    alpha = a;
  }

  const quadrant =
    input.dam_quadrant === undefined || input.dam_quadrant === null
      ? null
      : isDamQuadrant(input.dam_quadrant)
        ? input.dam_quadrant
        : null;
  if (input.dam_quadrant && !quadrant) {
    return { ok: false, error: "dam_quadrant must be Q1|Q2|Q3|Q4." };
  }

  const occurred = parseOccurredAt(input.occurred_at);
  if (occurred && typeof occurred === "object" && "error" in occurred) {
    return { ok: false, error: occurred.error };
  }

  return {
    ok: true,
    row: {
      agent_key: agent,
      outcome: input.outcome,
      override_trigger: isOverrideTrigger(input.override_trigger)
        ? input.override_trigger
        : null,
      surface,
      task_id: input.task_id || null,
      project_id: input.project_id || null,
      dam_quadrant: quadrant,
      dam_alpha: alpha,
      proposed_summary: input.proposed_summary
        ? String(input.proposed_summary).trim().slice(0, 500)
        : null,
      final_summary: input.final_summary
        ? String(input.final_summary).trim().slice(0, 500)
        : null,
      latency_s:
        input.latency_s == null || Number.isNaN(Number(input.latency_s))
          ? null
          : Math.max(0, Math.round(Number(input.latency_s))),
      reviewed_by_label: input.reviewed_by_label
        ? String(input.reviewed_by_label).trim().slice(0, 80)
        : null,
      ...(occurred ? { occurred_at: occurred } : {}),
      meta: input.meta && typeof input.meta === "object" ? input.meta : {},
    },
  };
}
