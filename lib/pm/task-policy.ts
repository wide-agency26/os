import { createAdminClient } from "@/utils/supabase/admin";
import type { PmTaskStatus } from "@/lib/pm/types";

export type TaskPolicyMode = "locked" | "default" | "free";

export type GlobalTaskPolicy = {
  retitle_mode: TaskPolicyMode;
  max_retitles: number;
  allow_polish: boolean;
  rule: string;
};

export type WaitingOn = "us" | "them";

export const DEFAULT_TASK_POLICY: GlobalTaskPolicy = {
  retitle_mode: "default",
  max_retitles: 2,
  allow_polish: false,
  rule:
    "Retitle only when work actually changed (wrong project, scope flip, unreadable title). Never for wording polish. At most 1–2 retitles in a task’s life.",
};

export const OS_TASK_STATUSES: PmTaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
];

/** Bot shorthand → OS status + waiting_on */
export type StatusMapResult = {
  status: PmTaskStatus;
  waiting_on: WaitingOn | null;
};

export function mapMcpStatus(input: string | null | undefined): StatusMapResult | { error: string } {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return { status: "todo", waiting_on: null };

  if (raw === "us") return { status: "in_progress", waiting_on: "us" };
  if (raw === "them") return { status: "blocked", waiting_on: "them" };
  if (raw === "parked") return { status: "blocked", waiting_on: null };
  if (raw === "done") return { status: "done", waiting_on: null };

  if ((OS_TASK_STATUSES as string[]).includes(raw)) {
    return {
      status: raw as PmTaskStatus,
      waiting_on: null,
    };
  }

  return {
    error: `Unknown status "${input}". Use us|them|parked|done or todo|in_progress|blocked|done|cancelled.`,
  };
}

export function parseGlobalTaskPolicy(value: unknown): GlobalTaskPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_TASK_POLICY };
  }
  const v = value as Record<string, unknown>;
  const mode = v.retitle_mode;
  const max = Number(v.max_retitles);
  return {
    retitle_mode:
      mode === "locked" || mode === "default" || mode === "free"
        ? mode
        : DEFAULT_TASK_POLICY.retitle_mode,
    max_retitles: Number.isFinite(max) && max >= 0 ? Math.floor(max) : DEFAULT_TASK_POLICY.max_retitles,
    allow_polish: v.allow_polish === true,
    rule: typeof v.rule === "string" && v.rule.trim() ? v.rule.trim() : DEFAULT_TASK_POLICY.rule,
  };
}

export function parseProjectTaskPolicy(value: unknown): TaskPolicyMode {
  if (value === "locked" || value === "default" || value === "free") return value;
  return "default";
}

/** Resolved mode: project override wins when not "default"; else global.retitle_mode */
export function resolveRetitleMode(
  projectPolicy: TaskPolicyMode,
  global: GlobalTaskPolicy
): TaskPolicyMode {
  if (projectPolicy === "locked" || projectPolicy === "free") return projectPolicy;
  return global.retitle_mode === "locked" || global.retitle_mode === "free"
    ? global.retitle_mode
    : "default";
}

function normalizeTitle(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Heuristic: titles that only differ by polish (punctuation/casing/articles) */
export function looksLikePolishOnly(from: string, to: string): boolean {
  const a = normalizeTitle(from);
  const b = normalizeTitle(to);
  if (a === b) return true;
  const strip = (t: string) =>
    t
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\b(the|a|an|to|for|of|and|or)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const sa = strip(a);
  const sb = strip(b);
  if (sa && sb && sa === sb) return true;
  // Very small edit distance relative to length → polish
  if (sa.length > 0 && sb.length > 0) {
    const longer = Math.max(sa.length, sb.length);
    const dist = levenshtein(sa, sb);
    if (dist <= 3 && dist / longer <= 0.15) return true;
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export type RetitleGate = {
  allowed: boolean;
  error?: string;
  nextRetitleCount?: number;
};

export function assertRetitleAllowed(opts: {
  currentTitle: string;
  nextTitle: string;
  retitleCount: number;
  projectPolicy: TaskPolicyMode;
  global: GlobalTaskPolicy;
  /** Bot/UI can claim a material reason; still blocked if polish-only when allow_polish=false */
  materialChange?: boolean;
}): RetitleGate {
  const next = opts.nextTitle.trim();
  if (!next) return { allowed: false, error: "Title required." };
  if (normalizeTitle(opts.currentTitle) === normalizeTitle(next)) {
    return { allowed: true, nextRetitleCount: opts.retitleCount };
  }

  const mode = resolveRetitleMode(opts.projectPolicy, opts.global);
  if (mode === "locked") {
    return { allowed: false, error: "Retitle locked for this project." };
  }
  if (mode === "free") {
    return { allowed: true, nextRetitleCount: opts.retitleCount + 1 };
  }

  // default mode
  if (!opts.global.allow_polish && looksLikePolishOnly(opts.currentTitle, next)) {
    return {
      allowed: false,
      error:
        "Retitle blocked: looks like wording polish only. Change only when work actually changed (wrong project, scope flip, unreadable title).",
    };
  }
  if (!opts.materialChange && looksLikePolishOnly(opts.currentTitle, next)) {
    return {
      allowed: false,
      error: "Retitle blocked: no material change detected.",
    };
  }
  const max = opts.global.max_retitles;
  if (opts.retitleCount >= max) {
    return {
      allowed: false,
      error: `Retitle blocked: already ${opts.retitleCount} retitle(s); max is ${max}.`,
    };
  }
  return { allowed: true, nextRetitleCount: opts.retitleCount + 1 };
}

export async function loadGlobalTaskPolicy(
  supabase?: ReturnType<typeof createAdminClient>
): Promise<GlobalTaskPolicy> {
  const db = supabase || createAdminClient();
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "task_policy")
    .maybeSingle();
  return parseGlobalTaskPolicy(data?.value);
}

export async function saveGlobalTaskPolicy(
  patch: Partial<GlobalTaskPolicy>,
  supabase?: ReturnType<typeof createAdminClient>
): Promise<GlobalTaskPolicy> {
  const db = supabase || createAdminClient();
  const current = await loadGlobalTaskPolicy(db);
  const next: GlobalTaskPolicy = {
    ...current,
    ...patch,
    max_retitles:
      patch.max_retitles !== undefined
        ? Math.max(0, Math.floor(Number(patch.max_retitles)))
        : current.max_retitles,
  };
  const { error } = await db.from("app_settings").upsert({
    key: "task_policy",
    value: next,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return next;
}

/** Gmail thread id vs freeform chat note → source + source_ref */
export function mapTaskSource(source: string | null | undefined): {
  source: "manual" | "email";
  source_ref: string | null;
} {
  const raw = String(source || "").trim();
  if (!raw) return { source: "manual", source_ref: null };
  // Gmail thread ids are typically long hex / base64-ish without spaces
  const looksThread =
    /^[0-9a-f]{10,}$/i.test(raw) ||
    /^thread[-_]?[a-z0-9]+$/i.test(raw) ||
    (/^[A-Za-z0-9_-]{16,}$/.test(raw) && !/\s/.test(raw));
  return {
    source: looksThread ? "email" : "manual",
    source_ref: raw.slice(0, 2000),
  };
}
