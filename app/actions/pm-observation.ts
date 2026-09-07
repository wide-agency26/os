"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { OVERRIDE_OUTCOMES, OVERRIDE_TRIGGERS } from "@/lib/pm/instrument";

export type ObservationSummary = {
  windowDays: number;
  since: string;
  tasks: {
    created: number;
    completed: number;
    reopened: number;
    byKind: Record<string, number>;
  };
  review: {
    pending: number;
    decided: number;
    byOutcome: Record<string, number>;
    byTrigger: Record<string, number>;
  };
  botOverrides: {
    total: number;
    numerator: number;
    byOutcome: Record<string, number>;
    byTrigger: Record<string, number>;
    byAgent: Record<string, number>;
    bySurface: Record<string, number>;
  };
};

function emptyOutcomeMap() {
  const byOutcome: Record<string, number> = {};
  for (const key of OVERRIDE_OUTCOMES) byOutcome[key] = 0;
  return byOutcome;
}

function emptyTriggerMap() {
  const byTrigger: Record<string, number> = {};
  for (const key of OVERRIDE_TRIGGERS) byTrigger[key] = 0;
  return byTrigger;
}

export async function getObservationSummary(
  windowDays = 14
): Promise<ObservationSummary | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { error: "Founders only." };
  }

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error: eventErr } = await supabase
    .from("pm_task_events")
    .select("event_kind, created_at")
    .gte("created_at", since)
    .limit(5000);

  if (eventErr) {
    return {
      error:
        eventErr.message.includes("pm_task_events") || eventErr.code === "PGRST205"
          ? "Apply the pm_task_observation migration, then reload."
          : eventErr.message,
    };
  }

  const eventList = events ?? [];
  const created = eventList.filter((e) => e.event_kind === "created").length;
  const completed = eventList.filter((e) => e.event_kind === "completed").length;
  const reopened = eventList.filter((e) => e.event_kind === "reopened").length;

  const { data: createdTasks } = await supabase
    .from("pm_tasks")
    .select("task_kind")
    .gte("created_at", since)
    .limit(5000);

  const byKind: Record<string, number> = {};
  for (const row of createdTasks ?? []) {
    const kind = row.task_kind || "unspecified";
    byKind[kind] = (byKind[kind] || 0) + 1;
  }

  const { count: pendingCount, error: pendingErr } = await supabase
    .from("task_review_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (pendingErr) return { error: pendingErr.message };

  const { data: decided, error: reviewErr } = await supabase
    .from("task_review_queue")
    .select("override_outcome, override_trigger, reviewed_at")
    .not("reviewed_at", "is", null)
    .gte("reviewed_at", since)
    .limit(5000);

  if (reviewErr) return { error: reviewErr.message };

  const byOutcome = emptyOutcomeMap();
  const byTrigger = emptyTriggerMap();

  for (const row of decided ?? []) {
    if (row.override_outcome) {
      byOutcome[row.override_outcome] = (byOutcome[row.override_outcome] || 0) + 1;
    }
    if (row.override_trigger) {
      byTrigger[row.override_trigger] = (byTrigger[row.override_trigger] || 0) + 1;
    }
  }

  const botByOutcome = emptyOutcomeMap();
  const botByTrigger = emptyTriggerMap();
  const byAgent: Record<string, number> = {};
  const bySurface: Record<string, number> = {};
  let botTotal = 0;
  let botNumerator = 0;

  const { data: botRows, error: botErr } = await supabase
    .from("ai_overrides")
    .select("outcome, override_trigger, agent_key, surface, created_at, occurred_at")
    .limit(5000);

  if (botErr) {
    if (
      botErr.message.includes("ai_overrides") ||
      botErr.code === "PGRST205" ||
      botErr.code === "42P01"
    ) {
      // Table not applied yet — still return the rest of the summary.
    } else {
      return { error: botErr.message };
    }
  } else {
    for (const row of botRows ?? []) {
      const when = String(row.occurred_at || row.created_at || "");
      if (!when || when < since) continue;
      botTotal += 1;
      if (row.outcome) {
        botByOutcome[row.outcome] = (botByOutcome[row.outcome] || 0) + 1;
        if (
          row.outcome === "edit" ||
          row.outcome === "replace" ||
          row.outcome === "regenerate" ||
          row.outcome === "block"
        ) {
          botNumerator += 1;
        }
      }
      if (row.override_trigger) {
        botByTrigger[row.override_trigger] =
          (botByTrigger[row.override_trigger] || 0) + 1;
      }
      const agent = row.agent_key || "unknown";
      byAgent[agent] = (byAgent[agent] || 0) + 1;
      const surface = row.surface || "other";
      bySurface[surface] = (bySurface[surface] || 0) + 1;
    }
  }

  return {
    windowDays,
    since,
    tasks: { created, completed, reopened, byKind },
    review: {
      pending: pendingCount ?? 0,
      decided: (decided ?? []).length,
      byOutcome,
      byTrigger,
    },
    botOverrides: {
      total: botTotal,
      numerator: botNumerator,
      byOutcome: botByOutcome,
      byTrigger: botByTrigger,
      byAgent,
      bySurface,
    },
  };
}
