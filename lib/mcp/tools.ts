import { createAdminClient } from "@/utils/supabase/admin";
import { createSowCore } from "@/lib/sow/create-sow-core";
import { loadSowDocument } from "@/lib/sow/load-sow";
import { assertSowWritable } from "@/lib/sow/frozen";
import { isUuid } from "@/lib/routing";
import { assertMcpLivePermalink } from "@/lib/mcp/content-post-guards";
import { mcpJsonResult, mcpSerialize } from "@/lib/mcp/serialize";
import {
  TASK_LIST_COMPACT_SELECT,
  TASK_MCP_SELECT,
  compactTaskRow,
  serializeTaskForMcp,
} from "@/lib/mcp/task-fields";
import { resolveClientTaskBodyInput, resolveTaskBodyInput } from "@/lib/pm/markdown-to-blocks";
import {
  assertRetitleAllowed,
  loadGlobalTaskPolicy,
  mapMcpStatus,
  mapTaskSource,
  parseGlobalTaskPolicy,
  parseProjectTaskPolicy,
  resolveRetitleMode,
  saveGlobalTaskPolicy,
  type GlobalTaskPolicy,
  type TaskPolicyMode,
  type WaitingOn,
} from "@/lib/pm/task-policy";
import {
  validateOverrideLog,
  type LogOverrideInput,
  type OverrideOutcome,
  type OverrideSurface,
  type OverrideTrigger,
  type DamQuadrant,
} from "@/lib/pm/instrument";

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: mcpSerialize(data),
      },
    ],
  };
}

function errResult(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

type OverrideAttach = {
  agent_key?: string;
  outcome?: OverrideOutcome;
  override_trigger?: OverrideTrigger | null;
  surface?: OverrideSurface;
  dam_quadrant?: DamQuadrant | null;
  dam_alpha?: 0 | 0.5 | 1 | null;
  proposed_summary?: string | null;
  final_summary?: string | null;
  latency_s?: number | null;
  reviewed_by_label?: string | null;
};

async function insertOverrideIfPresent(
  db: ReturnType<typeof createAdminClient>,
  attach: OverrideAttach | undefined,
  defaults: { task_id?: string | null; project_id?: string | null }
): Promise<{ logged: boolean; error?: string; id?: string }> {
  if (!attach?.agent_key && !attach?.outcome) return { logged: false };
  if (!attach?.agent_key || !attach?.outcome) {
    return {
      logged: false,
      error: "To log an override on this call, pass both agent_key and outcome (or use log_override).",
    };
  }
  const checked = validateOverrideLog({
    ...attach,
    agent_key: attach.agent_key,
    outcome: attach.outcome,
    task_id: defaults.task_id ?? null,
    project_id: defaults.project_id ?? null,
  } as LogOverrideInput);
  if (!checked.ok) return { logged: false, error: checked.error };

  const { data, error } = await db
    .from("ai_overrides")
    .insert(checked.row)
    .select("id")
    .single();
  if (error) return { logged: false, error: error.message };
  return { logged: true, id: data?.id };
}

/** Explicit human-vs-AI review decision. Log accept and disagreement alike (denominator). */
export async function toolLogOverride(input: LogOverrideInput) {
  const checked = validateOverrideLog(input);
  if (!checked.ok) return errResult(checked.error);

  if (checked.row.task_id && !isUuid(String(checked.row.task_id))) {
    return errResult("task_id must be a UUID when provided.");
  }
  if (checked.row.project_id && !isUuid(String(checked.row.project_id))) {
    return errResult("project_id must be a UUID when provided.");
  }

  const db = createAdminClient();
  if (checked.row.task_id) {
    const { data: task } = await db
      .from("pm_tasks")
      .select("id, project_id")
      .eq("id", checked.row.task_id)
      .maybeSingle();
    if (!task) return errResult("task_id not found.");
    if (!checked.row.project_id) checked.row.project_id = task.project_id;
  }
  if (checked.row.project_id) {
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", checked.row.project_id)
      .maybeSingle();
    if (!project) return errResult("project_id not found.");
  }

  const { data, error } = await db
    .from("ai_overrides")
    .insert(checked.row)
    .select(
      "id, agent_key, surface, outcome, override_trigger, task_id, project_id, occurred_at, created_at"
    )
    .single();
  if (error) return errResult(error.message);
  return textResult({ override: data, ok: true });
}

export async function toolListClients() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("crm_customers")
    .select("id, company, name, status")
    .eq("record_kind", "company")
    .order("company", { ascending: true })
    .limit(500);
  if (error) return errResult(error.message);
  const clients = (data || []).map((r) => ({
    id: r.id,
    name: (r.company || r.name || "Client").trim(),
    status: r.status,
  }));
  return textResult({ clients, count: clients.length });
}

export async function toolListProjects(clientId: string) {
  if (!isUuid(clientId)) return errResult("client_id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("projects")
    .select(
      "id, title, status, client_id, task_policy, client_visible, client_progress, updated_at"
    )
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return errResult(error.message);
  const { parseProjectProgress, progressSummaryForList } = await import(
    "@/lib/client/progress"
  );
  const projects = (data || []).map((row) => {
    const progress = parseProjectProgress(row.id as string, row.client_progress);
    const { client_progress: _drop, ...rest } = row as typeof row & {
      client_progress?: unknown;
    };
    return {
      ...rest,
      progress: progressSummaryForList(progress),
    };
  });
  return textResult({ projects, count: projects.length });
}

export async function toolGetProject(projectId: string) {
  if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  const [{ data: project, error }, global] = await Promise.all([
    db
      .from("projects")
      .select(
        "id, title, status, client_id, task_policy, client_visible, client_nav_tabs, client_progress, stage, deal_value, deal_frequency, deal_end_date, expected_start_date, start_date, estimated_cost, updated_at, created_at"
      )
      .eq("id", projectId)
      .maybeSingle(),
    loadGlobalTaskPolicy(db),
  ]);
  if (error) return errResult(error.message);
  if (!project) return errResult("Project not found.");
  const { parseProjectProgress } = await import("@/lib/client/progress");
  const progress = parseProjectProgress(projectId, project.client_progress);
  const { client_progress: _drop, ...projectRest } = project as typeof project & {
    client_progress?: unknown;
  };
  const override = parseProjectTaskPolicy(project.task_policy);
  const dealValue =
    project.deal_value === null || project.deal_value === undefined
      ? null
      : Number(project.deal_value);
  const monthly =
    project.deal_frequency === "monthly" ? dealValue : null;
  return textResult({
    project: {
      ...projectRest,
      task_policy: override,
      progress,
    },
    task_policy: {
      project_override: override,
      global,
      resolved_retitle_mode: resolveRetitleMode(override, global),
    },
    finance: {
      monthly_fee: monthly,
      revenue: dealValue,
      cost:
        project.estimated_cost === null || project.estimated_cost === undefined
          ? null
          : Number(project.estimated_cost),
      currency: "EUR",
      deal_value: dealValue,
      deal_frequency: project.deal_frequency,
      deal_end_date: project.deal_end_date,
      expected_start_date: project.expected_start_date,
    },
  });
}

export async function toolUpdateProjectProgress(input: {
  project_id: string;
  progress?: Record<string, unknown>;
  publish?: boolean;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("projects")
    .select("id, client_progress")
    .eq("id", input.project_id)
    .maybeSingle();
  if (error) return errResult(error.message);
  if (!row) return errResult("Project not found.");

  const {
    parseProjectProgress,
  } = await import("@/lib/client/progress");

  const current = parseProjectProgress(input.project_id, row.client_progress);
  const partial = (input.progress || {}) as Record<string, unknown>;
  const mergedRaw = {
    ...current,
    ...partial,
    project_id: input.project_id,
    stats: partial.stats !== undefined ? partial.stats : current.stats,
    items: partial.items !== undefined ? partial.items : current.items,
  };
  let next = parseProjectProgress(input.project_id, mergedRaw);

  const now = new Date().toISOString();
  // Writes publish by default (bot simplicity); pass publish:false to save draft metadata only.
  const shouldPublish = input.publish !== false;
  if (shouldPublish) {
    next = {
      ...next,
      published_at: now,
      published_by: next.published_by || "mcp",
      updated_at: now,
    };
  } else {
    next = { ...next, updated_at: now };
  }

  const { error: upErr } = await db
    .from("projects")
    .update({ client_progress: next, updated_at: now })
    .eq("id", input.project_id);
  if (upErr) return errResult(upErr.message);

  return textResult({ ok: true, progress: next });
}

export async function toolListTasks(input: {
  project_id: string;
  compact?: boolean;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  const compact = input.compact !== false;
  const db = createAdminClient();
  const select = compact ? TASK_LIST_COMPACT_SELECT : TASK_MCP_SELECT;
  const { data, error } = await db
    .from("pm_tasks")
    .select(select)
    .eq("project_id", input.project_id)
    .order("sort_order", { ascending: true })
    .limit(500);
  if (error) return errResult(error.message);
  const rows = (data || []) as unknown as Record<string, unknown>[];
  const tasks = compact ? rows.map(compactTaskRow) : rows.map(serializeTaskForMcp);
  return mcpJsonResult(
    {
      tasks,
      count: tasks.length,
      compact,
      hint: compact ? "Use get_task(task_id) for full content_blocks body." : undefined,
    },
    { guard: true }
  );
}

export async function toolGetTask(taskId: string) {
  if (!isUuid(taskId)) return errResult("task_id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("pm_tasks")
    .select(TASK_MCP_SELECT)
    .eq("id", taskId)
    .maybeSingle();
  if (error) return errResult(error.message);
  if (!data) return errResult("Task not found.");
  return textResult({
    task: serializeTaskForMcp(data as unknown as Record<string, unknown>),
  });
}

export async function toolCreateTask(input: {
  project_id: string;
  title: string;
  status?: string;
  waiting_on?: string | null;
  source?: string | null;
  last_evidence?: string | null;
  body_markdown?: string | null;
  body?: string | null;
  content_blocks?: unknown;
  client_body_markdown?: string | null;
  client_content_blocks?: unknown;
  client_visible?: boolean;
  /** Optional: log a human override in the same call (e.g. founder rewrote your draft before create). */
  override_agent_key?: string;
  override_outcome?: OverrideOutcome;
  override_trigger?: OverrideTrigger | null;
  override_surface?: OverrideSurface;
  override_quadrant?: DamQuadrant | null;
  override_alpha?: 0 | 0.5 | 1 | null;
  override_proposed?: string | null;
  override_final?: string | null;
  override_by?: string | null;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  const title = String(input.title || "").trim();
  if (!title) return errResult("title is required.");

  const mapped = mapMcpStatus(input.status || "todo");
  if ("error" in mapped) return errResult(mapped.error);

  let waiting: WaitingOn | null = mapped.waiting_on;
  if (input.waiting_on !== undefined && input.waiting_on !== null && input.waiting_on !== "") {
    const w = String(input.waiting_on).toLowerCase();
    if (w !== "us" && w !== "them") return errResult("waiting_on must be us|them or null.");
    waiting = w;
  }

  const src = mapTaskSource(input.source);
  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .maybeSingle();
  if (!project) return errResult("Project not found.");

  const { data: maxRow } = await db
    .from("pm_tasks")
    .select("sort_order")
    .eq("project_id", input.project_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const bodyFields =
    input.body_markdown !== undefined ||
    input.body !== undefined ||
    input.content_blocks !== undefined
      ? resolveTaskBodyInput(input)
      : null;
  if (bodyFields && !bodyFields.ok) return errResult(bodyFields.error);

  const clientBodyFields =
    input.client_body_markdown !== undefined || input.client_content_blocks !== undefined
      ? resolveClientTaskBodyInput(input)
      : null;
  if (clientBodyFields && !clientBodyFields.ok) return errResult(clientBodyFields.error);

  const row: Record<string, unknown> = {
    project_id: input.project_id,
    title,
    status: mapped.status,
    waiting_on: waiting,
    source: src.source,
    source_ref: src.source_ref,
    last_evidence: input.last_evidence?.trim()?.slice(0, 2000) || null,
    retitle_count: 0,
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    last_activity_at: now,
    started_at: mapped.status === "in_progress" ? now : null,
    completed_at: mapped.status === "done" ? now : null,
  };
  if (input.client_visible !== undefined) {
    row.client_visible = Boolean(input.client_visible);
  }
  if (bodyFields?.ok && bodyFields.content_blocks) {
    row.content_blocks = bodyFields.content_blocks;
    row.description = bodyFields.description;
  }
  if (clientBodyFields?.ok && clientBodyFields.client_content_blocks) {
    row.client_content_blocks = clientBodyFields.client_content_blocks;
  }

  const { data, error } = await db
    .from("pm_tasks")
    .insert(row)
    .select(TASK_MCP_SELECT)
    .single();
  if (error) return errResult(error.message);

  const override = await insertOverrideIfPresent(
    db,
    {
      agent_key: input.override_agent_key,
      outcome: input.override_outcome,
      override_trigger: input.override_trigger,
      surface: input.override_surface || "task",
      dam_quadrant: input.override_quadrant,
      dam_alpha: input.override_alpha,
      proposed_summary: input.override_proposed,
      final_summary: input.override_final,
      reviewed_by_label: input.override_by,
    },
    { task_id: data?.id, project_id: input.project_id }
  );
  if (override.error) return errResult(override.error);

  return textResult({
    task: serializeTaskForMcp(data as unknown as Record<string, unknown>),
    override_logged: override.logged,
    override_id: override.id,
  });
}

export async function toolUpdateTask(input: {
  task_id: string;
  project_id?: string;
  title?: string;
  status?: string;
  waiting_on?: string | null;
  source?: string | null;
  last_evidence?: string | null;
  body_markdown?: string | null;
  body?: string | null;
  content_blocks?: unknown;
  client_body_markdown?: string | null;
  client_content_blocks?: unknown;
  material_change?: boolean;
  client_visible?: boolean;
  /** Optional: log a human override in the same call. */
  override_agent_key?: string;
  override_outcome?: OverrideOutcome;
  override_trigger?: OverrideTrigger | null;
  override_surface?: OverrideSurface;
  override_quadrant?: DamQuadrant | null;
  override_alpha?: 0 | 0.5 | 1 | null;
  override_proposed?: string | null;
  override_final?: string | null;
  override_by?: string | null;
}) {
  if (!isUuid(input.task_id)) return errResult("task_id must be a UUID.");
  const db = createAdminClient();
  const { data: task, error: fetchErr } = await db
    .from("pm_tasks")
    .select("*, projects:project_id ( task_policy )")
    .eq("id", input.task_id)
    .maybeSingle();
  if (fetchErr) return errResult(fetchErr.message);
  if (!task) return errResult("Task not found.");

  const projectRaw = Array.isArray(task.projects) ? task.projects[0] : task.projects;
  const projectPolicy = parseProjectTaskPolicy(
    (projectRaw as { task_policy?: string } | null)?.task_policy
  );
  const global = await loadGlobalTaskPolicy(db);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    updated_at: now,
    last_activity_at: now,
  };

  if (input.project_id !== undefined) {
    if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
    const { data: targetProject } = await db
      .from("projects")
      .select("id")
      .eq("id", input.project_id)
      .maybeSingle();
    if (!targetProject) return errResult("Target project not found.");
    const { data: maxRow } = await db
      .from("pm_tasks")
      .select("sort_order")
      .eq("project_id", input.project_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    patch.project_id = input.project_id;
    patch.sort_order = (maxRow?.sort_order ?? 0) + 1;
  }

  if (input.title !== undefined) {
    const gate = assertRetitleAllowed({
      currentTitle: task.title || "",
      nextTitle: input.title,
      retitleCount: Number(task.retitle_count) || 0,
      projectPolicy,
      global,
      materialChange: input.material_change === true,
    });
    if (!gate.allowed) return errResult(gate.error || "Retitle not allowed.");
    patch.title = input.title.trim();
    patch.retitle_count = gate.nextRetitleCount ?? task.retitle_count;
  }

  if (input.status !== undefined) {
    const mapped = mapMcpStatus(input.status);
    if ("error" in mapped) return errResult(mapped.error);
    patch.status = mapped.status;
    if (input.waiting_on === undefined) {
      patch.waiting_on = mapped.waiting_on;
    }
    if (mapped.status === "done") {
      patch.completed_at = now;
      if (input.waiting_on === undefined) patch.waiting_on = null;
      if (!task.started_at) patch.started_at = now;
    } else if (task.status === "done") {
      patch.completed_at = null;
      patch.closed_by = null;
    }
    if (mapped.status === "in_progress" && !task.started_at) {
      patch.started_at = now;
    }
  }

  if (input.waiting_on !== undefined) {
    if (input.waiting_on === null || input.waiting_on === "") {
      patch.waiting_on = null;
    } else {
      const w = String(input.waiting_on).toLowerCase();
      if (w !== "us" && w !== "them") return errResult("waiting_on must be us|them or null.");
      patch.waiting_on = w;
    }
  }

  if (input.source !== undefined) {
    const src = mapTaskSource(input.source);
    patch.source = src.source;
    patch.source_ref = src.source_ref;
  }

  if (input.last_evidence !== undefined) {
    patch.last_evidence =
      input.last_evidence === null || input.last_evidence === ""
        ? null
        : String(input.last_evidence).trim().slice(0, 2000);
  }

  if (
    input.body_markdown !== undefined ||
    input.body !== undefined ||
    input.content_blocks !== undefined
  ) {
    const bodyFields = resolveTaskBodyInput(input);
    if (!bodyFields.ok) return errResult(bodyFields.error);
    if (bodyFields.content_blocks === null) {
      patch.content_blocks = null;
      patch.description = null;
    } else {
      patch.content_blocks = bodyFields.content_blocks;
      patch.description = bodyFields.description;
    }
  }

  if (
    input.client_body_markdown !== undefined ||
    input.client_content_blocks !== undefined
  ) {
    const clientBodyFields = resolveClientTaskBodyInput(input);
    if (!clientBodyFields.ok) return errResult(clientBodyFields.error);
    patch.client_content_blocks = clientBodyFields.client_content_blocks;
  }

  if (input.client_visible !== undefined) {
    patch.client_visible = Boolean(input.client_visible);
  }

  const { data, error } = await db
    .from("pm_tasks")
    .update(patch)
    .eq("id", input.task_id)
    .select(TASK_MCP_SELECT)
    .single();
  if (error) return errResult(error.message);

  const projectId =
    (data as { project_id?: string } | null)?.project_id ||
    (task as { project_id?: string }).project_id ||
    null;
  const override = await insertOverrideIfPresent(
    db,
    {
      agent_key: input.override_agent_key,
      outcome: input.override_outcome,
      override_trigger: input.override_trigger,
      surface: input.override_surface || "task",
      dam_quadrant: input.override_quadrant,
      dam_alpha: input.override_alpha,
      proposed_summary: input.override_proposed,
      final_summary: input.override_final,
      reviewed_by_label: input.override_by,
    },
    { task_id: input.task_id, project_id: projectId }
  );
  if (override.error) return errResult(override.error);

  return textResult({
    task: serializeTaskForMcp(data as unknown as Record<string, unknown>),
    override_logged: override.logged,
    override_id: override.id,
  });
}

export async function toolListDebugItems(opts?: {
  type?: "bug" | "enhancement";
  status?: string;
  limit?: number;
}) {
  const db = createAdminClient();
  let q = db
    .from("debug_reports")
    .select(
      "id, created_at, status, severity, report_type, title, what_happened, project_id, pathname, location_label, reporter_name"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(opts?.limit || 50, 1), 200));

  if (opts?.type) q = q.eq("report_type", opts.type);
  if (opts?.status) q = q.eq("status", opts.status);

  const { data, error } = await q;
  if (error) return errResult(error.message);
  return textResult({ items: data || [], count: (data || []).length });
}

export async function toolCreateDebugItem(input: {
  type: "bug" | "enhancement";
  title: string;
  body: string;
  project_id?: string | null;
}) {
  const title = String(input.title || "").trim().slice(0, 180);
  const body = String(input.body || "").trim();
  if (!title) return errResult("title is required.");
  if (!body) return errResult("body is required.");
  if (input.type !== "bug" && input.type !== "enhancement") {
    return errResult("type must be bug|enhancement.");
  }
  if (input.project_id && !isUuid(input.project_id)) {
    return errResult("project_id must be a UUID when provided.");
  }

  const db = createAdminClient();
  if (input.project_id) {
    const { data: p } = await db
      .from("projects")
      .select("id")
      .eq("id", input.project_id)
      .maybeSingle();
    if (!p) return errResult("Project not found.");
  }

  const { data: founder } = await db
    .from("profiles")
    .select("id, full_name")
    .in("role", ["superadmin", "admin"])
    .limit(1)
    .maybeSingle();
  if (!founder) return errResult("No founder profile available to attribute the report.");

  const agentBrief = [
    `# ${input.type === "enhancement" ? "Enhancement" : "Bug"} (via MCP)`,
    "",
    `**Title:** ${title}`,
    "",
    body,
    input.project_id ? `\n**Project:** ${input.project_id}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await db
    .from("debug_reports")
    .insert({
      reporter_id: founder.id,
      reporter_name: founder.full_name || "MCP bot",
      reporter_email: null,
      reporter_role: "mcp",
      status: "open",
      severity: input.type === "enhancement" ? "low" : "medium",
      report_type: input.type,
      title,
      what_happened: body.slice(0, 8000),
      project_id: input.project_id || null,
      context: { source: "mcp" },
      agent_brief: agentBrief,
      attachments: [],
      viewing_as_client: false,
    })
    .select("id, title, report_type, status, project_id, created_at")
    .single();

  if (error) return errResult(error.message);
  return textResult({ item: data });
}

export async function toolGetSettings() {
  const global = await loadGlobalTaskPolicy();
  return textResult({ task_policy: global });
}

export async function toolUpdateSettings(input: Partial<GlobalTaskPolicy>) {
  const patch: Partial<GlobalTaskPolicy> = {};
  if (input.retitle_mode !== undefined) {
    if (
      input.retitle_mode !== "locked" &&
      input.retitle_mode !== "default" &&
      input.retitle_mode !== "free"
    ) {
      return errResult("retitle_mode must be locked|default|free.");
    }
    patch.retitle_mode = input.retitle_mode;
  }
  if (input.max_retitles !== undefined) patch.max_retitles = input.max_retitles;
  if (input.allow_polish !== undefined) patch.allow_polish = Boolean(input.allow_polish);
  if (input.rule !== undefined) patch.rule = String(input.rule);
  try {
    const next = await saveGlobalTaskPolicy(patch);
    return textResult({ task_policy: next });
  } catch (e) {
    return errResult(e instanceof Error ? e.message : "Failed to save settings.");
  }
}

export async function toolSetProjectTaskPolicy(
  projectId: string,
  taskPolicy: TaskPolicyMode
): Promise<ReturnType<typeof textResult> | ReturnType<typeof errResult>> {
  if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
  if (taskPolicy !== "locked" && taskPolicy !== "default" && taskPolicy !== "free") {
    return errResult("task_policy must be locked|default|free.");
  }
  const db = createAdminClient();
  const { data, error } = await db
    .from("projects")
    .update({ task_policy: taskPolicy, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id, title, task_policy")
    .single();
  if (error) return errResult(error.message);
  return textResult({ project: data });
}

const PROJECT_STATUSES = ["pipeline", "running", "expired", "completed"] as const;
const CRM_STATUSES = ["Prospect", "Lead", "Client"] as const;
const DEBUG_STATUSES = ["open", "in_progress", "resolved", "hidden"] as const;

export async function toolUpdateClient(input: {
  id: string;
  name?: string;
  status?: string;
}) {
  if (!isUuid(input.id)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const { data: row, error: fetchErr } = await db
    .from("crm_customers")
    .select("id, record_kind, company, name, status")
    .eq("id", input.id)
    .maybeSingle();
  if (fetchErr) return errResult(fetchErr.message);
  if (!row) return errResult("Client not found.");
  if (row.record_kind !== "company") {
    return errResult("Only company clients can be updated via update_client.");
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    const name = String(input.name || "").trim();
    if (!name) return errResult("name cannot be empty.");
    patch.name = name;
    patch.company = name;
  }
  if (input.status !== undefined) {
    if (!(CRM_STATUSES as readonly string[]).includes(input.status)) {
      return errResult("status must be Prospect|Lead|Client.");
    }
    patch.status = input.status;
  }
  if (Object.keys(patch).length === 1) {
    return errResult("Provide name and/or status to update.");
  }

  const { data, error } = await db
    .from("crm_customers")
    .update(patch)
    .eq("id", input.id)
    .select("id, company, name, status, record_kind")
    .single();
  if (error) return errResult(error.message);
  return textResult({
    client: {
      id: data.id,
      name: (data.company || data.name || "").trim(),
      status: data.status,
    },
  });
}

export async function toolCreateClient(input: {
  name: string;
  status?: string;
}) {
  const name = String(input.name || "").trim();
  if (!name) return errResult("name is required.");
  const status = (input.status || "Prospect").trim();
  if (!(CRM_STATUSES as readonly string[]).includes(status)) {
    return errResult("status must be Prospect|Lead|Client.");
  }

  const db = createAdminClient();

  // Avoid duplicate company names (case-insensitive) — return existing if found.
  const { data: existing, error: findErr } = await db
    .from("crm_customers")
    .select("id, company, name, status, record_kind")
    .eq("record_kind", "company")
    .ilike("company", name)
    .limit(1)
    .maybeSingle();
  if (findErr) return errResult(findErr.message);
  if (existing?.id) {
    return textResult({
      client: {
        id: existing.id,
        name: (existing.company || existing.name || "").trim(),
        status: existing.status,
      },
      created: false,
      note: "Company already existed; returned existing row.",
    });
  }

  const { data, error } = await db
    .from("crm_customers")
    .insert({
      name,
      company: name,
      status,
      record_kind: "company",
      parent_company_id: null,
      lead_status: "Reached out",
    })
    .select("id, company, name, status, record_kind")
    .single();
  if (error) return errResult(error.message);

  return textResult({
    client: {
      id: data.id,
      name: (data.company || data.name || "").trim(),
      status: data.status,
    },
    created: true,
  });
}

export async function toolCreateProject(input: {
  client_id: string;
  title: string;
  status?: string;
  task_policy?: string;
}) {
  if (!isUuid(input.client_id)) return errResult("client_id must be a UUID.");
  const title = String(input.title || "").trim();
  if (!title) return errResult("title is required.");
  const status = (input.status || "running").trim();
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) {
    return errResult("status must be pipeline|running|expired|completed.");
  }
  const taskPolicy = parseProjectTaskPolicy(input.task_policy || "default");
  if (input.task_policy && input.task_policy !== taskPolicy) {
    return errResult("task_policy must be locked|default|free.");
  }

  const db = createAdminClient();
  const { data: company } = await db
    .from("crm_customers")
    .select("id, status, record_kind")
    .eq("id", input.client_id)
    .maybeSingle();
  if (!company || company.record_kind !== "company") {
    return errResult("client_id must be a CRM company.");
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("projects")
    .insert({
      client_id: input.client_id,
      title,
      status,
      task_policy: taskPolicy,
      stage: company.status === "Client" ? "client" : "prospect",
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, title, status, client_id, task_policy, stage, created_at, updated_at"
    )
    .single();
  if (error) return errResult(error.message);
  return textResult({ project: data });
}

export async function toolUpdateProject(input: {
  id: string;
  title?: string;
  status?: string;
  task_policy?: string;
  client_id?: string;
  client_visible?: boolean;
  client_nav_tabs?: string[];
  stage?: string;
}) {
  if (!isUuid(input.id)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const { data: existing } = await db
    .from("projects")
    .select("id")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) return errResult("Project not found.");

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) {
    const title = String(input.title || "").trim();
    if (!title) return errResult("title cannot be empty.");
    patch.title = title;
  }
  if (input.status !== undefined) {
    if (!(PROJECT_STATUSES as readonly string[]).includes(input.status)) {
      return errResult("status must be pipeline|running|expired|completed.");
    }
    patch.status = input.status;
  }
  if (input.task_policy !== undefined) {
    const tp = parseProjectTaskPolicy(input.task_policy);
    if (input.task_policy !== tp) {
      return errResult("task_policy must be locked|default|free.");
    }
    patch.task_policy = tp;
  }
  if (input.client_id !== undefined) {
    if (!isUuid(input.client_id)) return errResult("client_id must be a UUID.");
    const { data: company } = await db
      .from("crm_customers")
      .select("id, record_kind, status")
      .eq("id", input.client_id)
      .maybeSingle();
    if (!company || company.record_kind !== "company") {
      return errResult("client_id must be a CRM company.");
    }
    patch.client_id = input.client_id;
    if (company.status === "Client" && input.stage === undefined) {
      patch.stage = "client";
    }
  }
  if (input.client_visible !== undefined) {
    patch.client_visible = Boolean(input.client_visible);
  }
  if (input.client_nav_tabs !== undefined) {
    const { isClientNavKey } = await import("@/lib/client/nav");
    const tabs = (input.client_nav_tabs || [])
      .filter(isClientNavKey)
      .filter((k) => k !== "files" && k !== "progress");
    patch.client_nav_tabs = tabs;
  }
  if (input.stage !== undefined) {
    const stage = String(input.stage || "").trim();
    if (!stage) return errResult("stage cannot be empty.");
    patch.stage = stage;
  }
  if (Object.keys(patch).length === 1) {
    return errResult("Provide at least one field to update.");
  }

  const { data, error } = await db
    .from("projects")
    .update(patch)
    .eq("id", input.id)
    .select(
      "id, title, status, client_id, task_policy, client_visible, client_nav_tabs, stage, updated_at"
    )
    .single();
  if (error) return errResult(error.message);
  return textResult({ project: data });
}

export async function toolListPeople() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("people")
    .select(
      "id, full_name, primary_email, roster_status, kind, engagement_types ( key, label, assignable_to_tasks )"
    )
    .eq("roster_status", "active")
    .order("full_name")
    .limit(500);
  if (error) return errResult(error.message);

  const people = (data || [])
    .filter((p) => {
      const eng = Array.isArray(p.engagement_types)
        ? p.engagement_types[0]
        : p.engagement_types;
      return (
        (eng as { assignable_to_tasks?: boolean } | null)?.assignable_to_tasks !==
        false
      );
    })
    .map((p) => {
      const eng = Array.isArray(p.engagement_types)
        ? p.engagement_types[0]
        : p.engagement_types;
      return {
        id: p.id,
        full_name: p.full_name,
        primary_email: p.primary_email,
        kind: (p as { kind?: string }).kind === "bot" ? "bot" : "human",
        engagement:
          (eng as { label?: string; key?: string } | null)?.label ||
          (eng as { key?: string } | null)?.key ||
          null,
      };
    });

  return textResult({ people, count: people.length });
}

export async function toolCreatePerson(input: {
  name: string;
  kind?: "human" | "bot";
  email?: string | null;
  assignable_to_tasks?: boolean;
}) {
  const name = String(input.name || "").trim();
  if (!name) return errResult("name is required.");
  const kind = input.kind === "bot" ? "bot" : "human";
  let email =
    input.email === undefined || input.email === null
      ? null
      : String(input.email).trim().toLowerCase() || null;
  if (kind === "bot" && !email) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    email = `${slug || "agent"}@bots.wide`;
  }

  const db = createAdminClient();
  const { data: types, error: typeErr } = await db
    .from("engagement_types")
    .select("id, key, assignable_to_tasks")
    .order("sort_order");
  if (typeErr) return errResult(typeErr.message);

  const wantAssignable = input.assignable_to_tasks !== false;
  let engagement =
    kind === "bot"
      ? (types || []).find((t) => t.key === "bot")
      : (types || []).find((t) => t.key === "project_freelancer");
  if (!engagement) {
    engagement = (types || []).find(
      (t) => (t.assignable_to_tasks !== false) === wantAssignable
    );
  }
  if (!engagement) return errResult("No engagement type available.");

  if (wantAssignable && engagement.assignable_to_tasks === false) {
    const assignable = (types || []).find((t) => t.assignable_to_tasks !== false);
    if (!assignable) {
      return errResult("No assignable engagement type available.");
    }
    engagement = assignable;
  }
  if (!wantAssignable && engagement.assignable_to_tasks !== false) {
    const nonAssignable = (types || []).find(
      (t) => t.assignable_to_tasks === false
    );
    if (nonAssignable) engagement = nonAssignable;
  }

  const { data, error } = await db
    .from("people")
    .insert({
      full_name: name,
      name,
      primary_email: email,
      kind,
      roster_status: "active",
      engagement_type_id: engagement.id,
      person_type: "Freelancer",
      hourly_rate_cost: null,
      salary_base: null,
      expertise_tags: [],
    })
    .select(
      "id, full_name, primary_email, kind, roster_status, engagement_type_id"
    )
    .single();
  if (error) return errResult(error.message);

  return textResult({
    person: {
      id: data.id,
      full_name: data.full_name,
      primary_email: data.primary_email,
      kind: data.kind === "bot" ? "bot" : "human",
      roster_status: data.roster_status,
      engagement_type_id: data.engagement_type_id,
      assignable_to_tasks: engagement.assignable_to_tasks !== false,
    },
  });
}

export async function toolAssignTask(input: {
  task_id: string;
  assignee_person_id: string | null;
}) {
  if (!isUuid(input.task_id)) return errResult("task_id must be a UUID.");
  const personId = input.assignee_person_id;
  if (personId !== null && !isUuid(personId)) {
    return errResult("assignee_person_id must be a UUID or null.");
  }

  const db = createAdminClient();
  const { data: task, error: fetchErr } = await db
    .from("pm_tasks")
    .select("id, project_id")
    .eq("id", input.task_id)
    .maybeSingle();
  if (fetchErr) return errResult(fetchErr.message);
  if (!task) return errResult("Task not found.");

  let authUserId: string | null = null;
  if (personId) {
    const { data: person, error: personErr } = await db
      .from("people")
      .select(
        "id, auth_user_id, primary_email, roster_status, engagement_types ( assignable_to_tasks )"
      )
      .eq("id", personId)
      .maybeSingle();
    if (personErr || !person) {
      return errResult(personErr?.message || "Person not found in HR roster.");
    }
    if (person.roster_status !== "active") {
      return errResult("Only active roster people can be assigned.");
    }
    const eng = Array.isArray(person.engagement_types)
      ? person.engagement_types[0]
      : person.engagement_types;
    if ((eng as { assignable_to_tasks?: boolean } | null)?.assignable_to_tasks === false) {
      return errResult("This engagement type is not assignable to project tasks.");
    }
    authUserId = person.auth_user_id || null;
    if (!authUserId && person.primary_email) {
      const { data: linkedId } = await db.rpc("link_person_to_auth_by_email", {
        p_person_id: personId,
      });
      if (linkedId) authUserId = linkedId as string;
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("pm_tasks")
    .update({
      assignee_person_id: personId,
      assignee_id: authUserId,
      last_activity_at: now,
      updated_at: now,
    })
    .eq("id", input.task_id)
    .select(
      "id, project_id, title, status, assignee_person_id, assignee_id, updated_at"
    )
    .single();
  if (error) return errResult(error.message);

  try {
    const { syncProjectAssignmentCosts } = await import("@/lib/accounting/sync");
    await syncProjectAssignmentCosts(task.project_id, db);
  } catch (e) {
    console.error("[mcp] assignee cost sync", e);
  }

  return textResult({ task: data });
}

export async function toolUpdateDebugItem(input: {
  id: string;
  status: string;
  resolution_note?: string | null;
}) {
  if (!isUuid(input.id)) return errResult("id must be a UUID.");
  if (!(DEBUG_STATUSES as readonly string[]).includes(input.status)) {
    return errResult("status must be open|in_progress|resolved|hidden.");
  }

  const db = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  };
  if (input.status === "resolved" || input.status === "hidden") {
    patch.resolved_at = now;
    if (input.resolution_note !== undefined) {
      patch.resolution_note =
        input.resolution_note === null || input.resolution_note === ""
          ? null
          : String(input.resolution_note).slice(0, 4000);
    }
  } else {
    patch.resolved_at = null;
    patch.resolved_by = null;
    patch.resolution_note = null;
  }

  const { data, error } = await db
    .from("debug_reports")
    .update(patch)
    .eq("id", input.id)
    .select("id, title, status, report_type, resolved_at, resolution_note, updated_at")
    .single();
  if (error) return errResult(error.message);
  return textResult({ item: data });
}

export async function toolGetProjectFinance(projectId: string) {
  if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  const { data: project, error } = await db
    .from("projects")
    .select(
      "id, title, client_id, status, stage, deal_value, deal_frequency, deal_end_date, expected_start_date, start_date, estimated_cost"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error) return errResult(error.message);
  if (!project) return errResult("Project not found.");

  const dealValue =
    project.deal_value === null || project.deal_value === undefined
      ? null
      : Number(project.deal_value);
  const cost =
    project.estimated_cost === null || project.estimated_cost === undefined
      ? null
      : Number(project.estimated_cost);

  return textResult({
    project_id: project.id,
    title: project.title,
    monthly_fee: project.deal_frequency === "monthly" ? dealValue : null,
    revenue: dealValue,
    cost,
    currency: "EUR",
    deal_value: dealValue,
    deal_frequency: project.deal_frequency,
    deal_end_date: project.deal_end_date,
    expected_start_date: project.expected_start_date,
    start_date: project.start_date,
    estimated_cost: cost,
    stage: project.stage,
    status: project.status,
  });
}

export async function toolUpdateProjectFinance(input: {
  project_id: string;
  monthly_fee?: number | null;
  currency?: string | null;
  cost?: number | null;
  revenue?: number | null;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  if (
    input.currency !== undefined &&
    input.currency !== null &&
    String(input.currency).trim() !== "" &&
    String(input.currency).trim().toUpperCase() !== "EUR"
  ) {
    return errResult("currency must be EUR (OS is EUR-only).");
  }

  const db = createAdminClient();
  const { data: existing } = await db
    .from("projects")
    .select("id, deal_value, deal_frequency, estimated_cost")
    .eq("id", input.project_id)
    .maybeSingle();
  if (!existing) return errResult("Project not found.");

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.monthly_fee !== undefined) {
    if (input.monthly_fee === null) {
      patch.deal_value = null;
      patch.deal_frequency = "one_off";
    } else {
      const n = Number(input.monthly_fee);
      if (!Number.isFinite(n) || n < 0) {
        return errResult("monthly_fee must be a non-negative number or null.");
      }
      patch.deal_value = n;
      patch.deal_frequency = "monthly";
    }
  } else if (input.revenue !== undefined) {
    if (input.revenue === null) {
      patch.deal_value = null;
    } else {
      const n = Number(input.revenue);
      if (!Number.isFinite(n) || n < 0) {
        return errResult("revenue must be a non-negative number or null.");
      }
      patch.deal_value = n;
      if (!existing.deal_frequency) patch.deal_frequency = "one_off";
    }
  }

  if (input.cost !== undefined) {
    if (input.cost === null) {
      patch.estimated_cost = null;
    } else {
      const n = Number(input.cost);
      if (!Number.isFinite(n) || n < 0) {
        return errResult("cost must be a non-negative number or null.");
      }
      patch.estimated_cost = n;
    }
  }

  if (Object.keys(patch).length === 1) {
    return errResult("Provide monthly_fee, revenue, and/or cost to update.");
  }

  const { error } = await db.from("projects").update(patch).eq("id", input.project_id);
  if (error) return errResult(error.message);

  if (patch.deal_value !== undefined || patch.deal_frequency !== undefined) {
    try {
      const { syncProjectRevenue } = await import("@/lib/accounting/sync");
      const sync = await syncProjectRevenue(input.project_id, db);
      if (!sync.ok) {
        return errResult(sync.error || "Deal saved but ledger sync failed.");
      }
    } catch (e) {
      return errResult(
        e instanceof Error ? e.message : "Deal saved but ledger sync failed."
      );
    }
  }

  return toolGetProjectFinance(input.project_id);
}

/** ---------- Content calendar (for production bots) ---------- */

export async function toolListContentCalendars(projectId: string) {
  if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_calendars")
    .select("id, project_id, period_start, status, theme_notes, updated_at")
    .eq("project_id", projectId)
    .order("period_start", { ascending: false })
    .limit(36);
  if (error) return errResult(error.message);
  return textResult({ calendars: data || [], count: (data || []).length });
}

export async function toolGetContentMonth(input: {
  project_id: string;
  period_start?: string | null;
  calendar_id?: string | null;
  compact?: boolean;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  let calendarRows: any[] | null = null;
  let calErr: { message: string } | null = null;
  if (input.calendar_id) {
    if (!isUuid(input.calendar_id)) return errResult("calendar_id must be a UUID.");
    const res = await db
      .from("content_calendars")
      .select("*")
      .eq("project_id", input.project_id)
      .eq("id", input.calendar_id)
      .limit(1);
    calendarRows = res.data;
    calErr = res.error;
  } else if (input.period_start) {
    const raw = input.period_start.slice(0, 10);
    const ps = raw.length === 7 ? `${raw}-01` : raw;
    const res = await db
      .from("content_calendars")
      .select("*")
      .eq("project_id", input.project_id)
      .eq("period_start", ps)
      .limit(1);
    calendarRows = res.data;
    calErr = res.error;
  } else {
    const res = await db
      .from("content_calendars")
      .select("*")
      .eq("project_id", input.project_id)
      .order("period_start", { ascending: false })
      .limit(1);
    calendarRows = res.data;
    calErr = res.error;
  }
  if (calErr) return errResult(calErr.message);
  const cal = calendarRows?.[0];
  if (!cal) return errResult("Content calendar month not found.");

  const { data: posts, error: postErr } = await db
    .from("content_posts")
    .select("*")
    .eq("calendar_id", cal.id)
    .order("scheduled_date")
    .order("post_number");
  if (postErr) return errResult(postErr.message);

  const compact = input.compact !== false;
  const { mapPost } = await import("@/lib/content/load");
  const { captionsWithHashtags } = await import("@/lib/content/types");
  const { formatSpecFor } = await import("@/lib/content/formats");

  const mapped = compact
    ? ((posts || []) as any[]).map((row) => {
        const p = mapPost(row);
        return {
          id: p.id,
          post_number: p.post_number,
          scheduled_date: p.scheduled_date,
          status_approval: p.status_approval,
          status_production: p.status_production,
          platforms: p.platforms,
          media_kind: p.media_kind,
        };
      })
    : ((posts || []) as any[]).map((row) => {
        const p = mapPost(row);
        const fmt = formatSpecFor(p.visual_format, p.is_video);
        return {
          ...p,
          captions: captionsWithHashtags(p),
          hashtags: {},
          visual_format_spec: {
            id: fmt.id,
            label: fmt.label,
            aspect: fmt.aspect,
            width: fmt.width,
            height: fmt.height,
            short_label: fmt.shortLabel,
          },
        };
      });

  return mcpJsonResult(
    {
      calendar: {
        id: cal.id,
        project_id: cal.project_id,
        period_start: String(cal.period_start).slice(0, 10),
        status: cal.status,
        ...(compact ? {} : { theme_notes: cal.theme_notes }),
      },
      posts: mapped,
      count: mapped.length,
      compact,
      hint: compact
        ? "Use get_content_post(post_id) for captions, media[], and visual_brief. Set WIP previews via update_content_post visual_asset_url, image_urls, or media."
        : undefined,
    },
    { guard: true }
  );
}

export async function toolGetContentPost(postId: string) {
  if (!isUuid(postId)) return errResult("post_id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db.from("content_posts").select("*").eq("id", postId).maybeSingle();
  if (error) return errResult(error.message);
  if (!data) return errResult("Post not found.");
  const { mapPost } = await import("@/lib/content/load");
  const { captionsWithHashtags } = await import("@/lib/content/types");
  const { formatSpecFor } = await import("@/lib/content/formats");
  const p = mapPost(data);
  const fmt = formatSpecFor(p.visual_format, p.is_video);
  return textResult({
    post: {
      ...p,
      captions: captionsWithHashtags(p),
      hashtags: {},
      visual_format_spec: {
        id: fmt.id,
        label: fmt.label,
        aspect: fmt.aspect,
        width: fmt.width,
        height: fmt.height,
        short_label: fmt.shortLabel,
      },
    },
  });
}

export async function toolUpdateContentPost(input: {
  post_id: string;
  hook_angle?: string | null;
  pillar?: string | null;
  captions?: Record<string, Record<string, string>> | null;
  visual_brief?: Record<string, string> | null;
  visual_asset_url?: string | null;
  visual_format?: "feed" | "reel" | "story" | null;
  media_kind?: "image" | "carousel" | "video" | null;
  media?: Array<Record<string, unknown>> | null;
  media_by_platform?: Record<string, Array<Record<string, unknown>>> | null;
  image_urls?: string[] | null;
  published_permalink?: string | null;
  published_links?: { instagram?: string; linkedin?: string } | null;
  story_repost?: Record<string, unknown> | null;
  linked_post_id?: string | null;
  remarks?: string | null;
  team_reshare_captions?: Record<string, string> | null;
  platforms?: string[] | null;
  is_video?: boolean | null;
  status_approval?: string | null;
  status_production?: string | null;
  ad_status?: string | null;
  angle_approved?: boolean | null;
  scheduled_date?: string | null;
  post_number?: number | null;
}) {
  if (!isUuid(input.post_id)) return errResult("post_id must be a UUID.");
  const db = createAdminClient();
  const { data: existing, error: loadErr } = await db
    .from("content_posts")
    .select("*")
    .eq("id", input.post_id)
    .maybeSingle();
  if (loadErr) return errResult(loadErr.message);
  if (!existing) return errResult("Post not found.");

  const revertingWip =
    input.status_production === "wip" && existing.status_production === "live";
  const staysLive =
    existing.status_production === "live" && input.status_production !== "wip";
  const touchesMedia =
    input.media !== undefined ||
    input.media_by_platform !== undefined ||
    input.media_kind !== undefined ||
    input.visual_asset_url !== undefined ||
    input.image_urls !== undefined;

  if (staysLive && touchesMedia && !revertingWip) {
    return errResult(
      "Live posts cannot change media previews. Set status_production=wip first, or update published_links only."
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.hook_angle !== undefined) patch.hook_angle = input.hook_angle;
  if (input.pillar !== undefined) patch.pillar = input.pillar;
  if (input.captions !== undefined) {
    patch.captions = input.captions || {};
    patch.hashtags = {};
  }
  if (input.visual_brief !== undefined) patch.visual_brief = input.visual_brief || {};
  if (input.visual_asset_url !== undefined) patch.visual_asset_url = input.visual_asset_url;
  if (input.media_kind !== undefined && input.media_kind) patch.media_kind = input.media_kind;
  if (input.media !== undefined) patch.media = input.media || [];
  if (input.media_by_platform !== undefined) {
    patch.media_by_platform = input.media_by_platform || {};
  }
  if (input.image_urls !== undefined) patch.image_urls = input.image_urls || [];
  if (input.published_links !== undefined) {
    patch.published_links = input.published_links || {};
  }
  if (input.published_permalink !== undefined) {
    patch.published_permalink = input.published_permalink || null;
  }
  if (input.visual_format !== undefined && input.visual_format) {
    patch.visual_format = input.visual_format;
  }
  if (input.is_video !== undefined && input.is_video !== null && input.visual_format === undefined) {
    patch.is_video = input.is_video;
    patch.visual_format = input.is_video ? "reel" : "feed";
  }
  if (input.story_repost !== undefined) patch.story_repost = input.story_repost;
  if (input.linked_post_id !== undefined) patch.linked_post_id = input.linked_post_id;
  if (input.remarks !== undefined) patch.remarks = input.remarks;
  if (input.team_reshare_captions !== undefined) {
    patch.team_reshare_captions = input.team_reshare_captions || {};
  }
  if (input.platforms !== undefined && input.platforms) patch.platforms = input.platforms;
  if (input.status_approval !== undefined) {
    patch.status_approval = input.status_approval;
    if (input.status_approval === "approved") {
      patch.locked = true;
      patch.angle_approved = true;
    }
  }
  if (input.status_production !== undefined) {
    patch.status_production = input.status_production;
    if (input.status_production === "live") patch.locked = true;
    if (revertingWip) patch.locked = false;
  }
  if (input.ad_status !== undefined) patch.ad_status = input.ad_status;
  if (input.angle_approved !== undefined) patch.angle_approved = input.angle_approved;
  if (input.scheduled_date !== undefined && input.scheduled_date) {
    patch.scheduled_date = input.scheduled_date.slice(0, 10);
  }
  if (input.post_number !== undefined && input.post_number !== null) {
    const pn = Number(input.post_number);
    if (!Number.isInteger(pn) || pn < 1) {
      return errResult("post_number must be a positive integer.");
    }
    const { data: clash } = await db
      .from("content_posts")
      .select("id")
      .eq("project_id", existing.project_id as string)
      .eq("post_number", pn)
      .neq("id", input.post_id)
      .maybeSingle();
    if (clash) {
      return errResult(`post_number ${pn} already exists on this project.`);
    }
    patch.post_number = pn;
  }

  const nextProduction =
    input.status_production !== undefined
      ? input.status_production
      : (existing.status_production as string);
  const existingLinks = (existing.published_links || {}) as {
    instagram?: string;
    linkedin?: string;
  };
  const liveCheck = assertMcpLivePermalink(
    nextProduction,
    input.published_permalink !== undefined
      ? input.published_permalink
      : input.published_links?.instagram,
    (existing.published_permalink as string | null) || existingLinks.instagram || null,
    input.published_links?.linkedin ?? existingLinks.linkedin ?? null
  );
  if (!liveCheck.ok) return errResult(liveCheck.error);
  if (nextProduction === "live") {
    const links: Record<string, string> = {};
    if (liveCheck.permalink) links.instagram = liveCheck.permalink;
    if (liveCheck.linkedin) links.linkedin = liveCheck.linkedin;
    patch.published_links = links;
    patch.published_permalink = liveCheck.permalink;
  }

  if (touchesMedia || patch.visual_format !== undefined) {
    const { applyMcpContentMediaInput } = await import("@/lib/content/post-patch");
    const { assertPublicMediaPatch } = await import("@/lib/content/upload-post-media");
    const mediaErr = assertPublicMediaPatch(patch);
    if (mediaErr) return errResult(mediaErr);
    try {
      applyMcpContentMediaInput(patch, existing);
    } catch (err: any) {
      return errResult(err?.message || "Invalid media URL");
    }
  }

  if (Object.keys(patch).length === 1) {
    return errResult("Provide at least one field to update.");
  }

  const { error } = await db.from("content_posts").update(patch).eq("id", input.post_id);
  if (error) return errResult(error.message);
  return toolGetContentPost(input.post_id);
}

export async function toolDeleteContentPost(postId: string) {
  if (!isUuid(postId)) return errResult("post_id must be a UUID.");
  const db = createAdminClient();
  const { data: existing, error: loadErr } = await db
    .from("content_posts")
    .select("id, post_number, calendar_id, scheduled_date, project_id")
    .eq("id", postId)
    .maybeSingle();
  if (loadErr) return errResult(loadErr.message);
  if (!existing) return errResult("Post not found.");

  const { error: delErr } = await db.from("content_posts").delete().eq("id", postId);
  if (delErr) return errResult(delErr.message);

  return textResult({
    ok: true,
    deleted: {
      id: existing.id,
      post_number: existing.post_number,
      calendar_id: existing.calendar_id,
      scheduled_date: existing.scheduled_date,
      project_id: existing.project_id,
    },
  });
}

export async function toolListBlogArticles(input: {
  project_id: string;
  limit?: number;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const db = createAdminClient();
  const { data, error } = await db
    .from("blog_articles")
    .select(
      "id, project_id, title, slug, language, status, pipeline_stage, scheduled_for, published_at, published_url, meta_description, client_visible, updated_at"
    )
    .eq("project_id", input.project_id)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) return errResult(error.message);
  return textResult({
    articles: data || [],
    count: (data || []).length,
    visual_format_spec: {
      id: "blog_cover",
      label: "Blog cover",
      aspect: "16:9",
      width: 1600,
      height: 900,
      short_label: "16:9 · 1600×900",
    },
  });
}

export async function toolGetBlogArticle(articleId: string) {
  if (!isUuid(articleId)) return errResult("article_id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("blog_articles")
    .select("*")
    .eq("id", articleId)
    .maybeSingle();
  if (error) return errResult(error.message);
  if (!data) return errResult("Article not found.");
  return textResult({
    article: data,
    visual_format_spec: {
      id: "blog_cover",
      label: "Blog cover",
      aspect: "16:9",
      width: 1600,
      height: 900,
      short_label: "16:9 · 1600×900",
    },
  });
}

/** ---------- Content create / calendar status ---------- */

const APPROVAL_STATUSES = [
  "draft",
  "needs_review",
  "approved",
  "on_hold",
  "needs_revision",
] as const;
const PRODUCTION_STATUSES = ["wip", "live"] as const;
const CALENDAR_STATUSES = ["draft", "in_review", "approved"] as const;

export async function toolUpdateContentCalendar(input: {
  calendar_id?: string;
  project_id?: string;
  period_start?: string;
  status?: string;
  theme_notes?: string | null;
  unlock_drafts?: boolean;
}) {
  const db = createAdminClient();
  let calendarId = input.calendar_id || null;
  let projectId = input.project_id || null;

  if (calendarId) {
    if (!isUuid(calendarId)) return errResult("calendar_id must be a UUID.");
    const { data: cal, error } = await db
      .from("content_calendars")
      .select("id, project_id, status")
      .eq("id", calendarId)
      .maybeSingle();
    if (error) return errResult(error.message);
    if (!cal) return errResult("Calendar not found.");
    projectId = cal.project_id as string;
  } else if (projectId && input.period_start) {
    if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
    const raw = input.period_start.slice(0, 10);
    const ps = raw.length === 7 ? `${raw}-01` : raw;
    const { ensureCalendar } = await import("@/lib/content/load");
    const cal = await ensureCalendar(db, projectId, ps);
    calendarId = cal.id;
  } else {
    return errResult("Provide calendar_id, or project_id + period_start.");
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) {
    if (!(CALENDAR_STATUSES as readonly string[]).includes(input.status)) {
      return errResult("status must be draft|in_review|approved.");
    }
    patch.status = input.status;
  }
  if (input.theme_notes !== undefined) patch.theme_notes = input.theme_notes;

  if (Object.keys(patch).length === 1) {
    return errResult("Provide status and/or theme_notes.");
  }

  const { data, error } = await db
    .from("content_calendars")
    .update(patch)
    .eq("id", calendarId!)
    .select("id, project_id, period_start, status, theme_notes, updated_at")
    .single();
  if (error) return errResult(error.message);

  const shouldUnlock =
    input.unlock_drafts !== false &&
    (input.status === "in_review" || input.status === "approved");
  if (shouldUnlock) {
    await db
      .from("content_posts")
      .update({
        status_approval: "needs_review",
        updated_at: new Date().toISOString(),
      })
      .eq("calendar_id", calendarId!)
      .eq("locked", false)
      .in("status_approval", ["draft", "on_hold"]);
  }

  return textResult({ calendar: data });
}

export async function toolCreateContentPost(input: {
  calendar_id?: string;
  project_id?: string;
  period_start?: string;
  scheduled_date?: string | null;
  hook_angle?: string | null;
  pillar?: string | null;
  platforms?: string[] | null;
  status_approval?: string | null;
  status_production?: string | null;
  ad_status?: string | null;
  visual_format?: "feed" | "reel" | "story" | null;
  media_kind?: "image" | "carousel" | "video" | null;
  media?: Array<Record<string, unknown>> | null;
  media_by_platform?: Record<string, Array<Record<string, unknown>>> | null;
  image_urls?: string[] | null;
  is_video?: boolean | null;
  captions?: Record<string, Record<string, string>> | null;
  visual_brief?: Record<string, string> | null;
  visual_asset_url?: string | null;
  published_permalink?: string | null;
  published_links?: { instagram?: string; linkedin?: string } | null;
  remarks?: string | null;
  team_reshare_captions?: Record<string, string> | null;
  story_repost?: Record<string, unknown> | null;
  linked_post_id?: string | null;
  angle_approved?: boolean | null;
  post_number?: number | null;
}) {
  const db = createAdminClient();
  let calendarId = input.calendar_id || null;
  let projectId = input.project_id || null;

  if (calendarId) {
    if (!isUuid(calendarId)) return errResult("calendar_id must be a UUID.");
    const { data: cal, error } = await db
      .from("content_calendars")
      .select("id, project_id, period_start")
      .eq("id", calendarId)
      .maybeSingle();
    if (error) return errResult(error.message);
    if (!cal) return errResult("Calendar not found.");
    projectId = cal.project_id as string;
  } else if (projectId && input.period_start) {
    if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
    const raw = input.period_start.slice(0, 10);
    const ps = raw.length === 7 ? `${raw}-01` : raw;
    const { ensureCalendar } = await import("@/lib/content/load");
    const cal = await ensureCalendar(db, projectId, ps);
    calendarId = cal.id;
  } else if (projectId && input.scheduled_date) {
    if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
    const d = input.scheduled_date.slice(0, 10);
    const ps = `${d.slice(0, 7)}-01`;
    const { ensureCalendar } = await import("@/lib/content/load");
    const cal = await ensureCalendar(db, projectId, ps);
    calendarId = cal.id;
  } else {
    return errResult(
      "Provide calendar_id, or project_id + period_start (or scheduled_date)."
    );
  }

  if (input.status_approval && !(APPROVAL_STATUSES as readonly string[]).includes(input.status_approval)) {
    return errResult(
      "status_approval must be draft|needs_review|approved|on_hold|needs_revision."
    );
  }
  if (
    input.status_production &&
    !(PRODUCTION_STATUSES as readonly string[]).includes(input.status_production)
  ) {
    return errResult("status_production must be wip|live.");
  }

  const { allocatePostNumbers } = await import("@/lib/content/load");
  let postNumber: number;
  if (input.post_number !== undefined && input.post_number !== null) {
    postNumber = Number(input.post_number);
    if (!Number.isInteger(postNumber) || postNumber < 1) {
      return errResult("post_number must be a positive integer.");
    }
    const { data: clash } = await db
      .from("content_posts")
      .select("id")
      .eq("project_id", projectId!)
      .eq("post_number", postNumber)
      .maybeSingle();
    if (clash) {
      return errResult(`post_number ${postNumber} already exists on this project.`);
    }
  } else {
    [postNumber] = await allocatePostNumbers(db, projectId!, 1);
  }

  const { data: calRow } = await db
    .from("content_calendars")
    .select("period_start")
    .eq("id", calendarId!)
    .maybeSingle();
  const periodStart = String(calRow?.period_start || "").slice(0, 10);
  // scheduled_date is NOT NULL in Postgres — fall back to month start when omitted (stubs).
  const scheduledDate = input.scheduled_date
    ? input.scheduled_date.slice(0, 10)
    : periodStart || new Date().toISOString().slice(0, 10);

  const isVideo =
    input.media_kind === "video"
      ? true
      : input.visual_format === "reel"
        ? true
        : input.visual_format === "feed" || input.visual_format === "story"
          ? false
          : Boolean(input.is_video);
  const visualFormat =
    input.visual_format || (isVideo ? "reel" : "feed");
  const mediaKind =
    input.media_kind || (isVideo ? "video" : "image");
  const approval = input.status_approval || "draft";
  const production = input.status_production || "wip";

  const liveCheck = assertMcpLivePermalink(
    production,
    input.published_permalink ?? input.published_links?.instagram,
    null,
    input.published_links?.linkedin
  );
  if (!liveCheck.ok) return errResult(liveCheck.error);

  const published_links: Record<string, string> = {
    ...(input.published_links || {}),
  };
  if (liveCheck.permalink) published_links.instagram = liveCheck.permalink;
  if (liveCheck.linkedin) published_links.linkedin = liveCheck.linkedin;

  const media =
    input.media ||
    (Array.isArray(input.image_urls) && input.image_urls.length
      ? input.image_urls
          .map((u) => String(u || "").trim())
          .filter(Boolean)
          .map((url) => ({
            id: crypto.randomUUID(),
            url,
            kind: "image",
            source: "url",
          }))
      : input.visual_asset_url
        ? [
            {
              id: crypto.randomUUID(),
              url: input.visual_asset_url,
              kind: isVideo ? "video" : "image",
              source: "url",
            },
          ]
        : []);

  const rowPatch: Record<string, unknown> = {
    calendar_id: calendarId,
    project_id: projectId,
    post_number: postNumber,
    platforms: input.platforms?.length ? input.platforms : ["linkedin", "instagram"],
    scheduled_date: scheduledDate,
    pillar: input.pillar ?? null,
    hook_angle: input.hook_angle ?? null,
    captions: input.captions || {},
    hashtags: {},
    visual_brief: input.visual_brief || {},
    published_permalink:
      production === "live" ? liveCheck.permalink : input.published_permalink?.trim() || null,
    published_links,
    media_by_platform: input.media_by_platform || {},
    visual_format: visualFormat,
    status_approval: approval,
    status_production: production,
    ad_status: input.ad_status || "organic",
    angle_approved: input.angle_approved ?? false,
    locked: approval === "approved" || production === "live",
    remarks: input.remarks ?? null,
    team_reshare_captions: input.team_reshare_captions || {},
    story_repost: input.story_repost ?? null,
    linked_post_id: input.linked_post_id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.media !== undefined || input.image_urls !== undefined || input.visual_asset_url) {
    rowPatch.media = media;
    rowPatch.media_kind =
      input.media_kind ||
      (media.length > 1 ? "carousel" : isVideo ? "video" : "image");
  } else {
    rowPatch.media = [];
    rowPatch.media_kind = mediaKind;
    rowPatch.visual_asset_url = input.visual_asset_url ?? null;
    rowPatch.is_video = isVideo;
  }

  const { applyMcpContentMediaInput } = await import("@/lib/content/post-patch");
  const { assertPublicMediaPatch } = await import("@/lib/content/upload-post-media");
  const mediaErr = assertPublicMediaPatch(rowPatch);
  if (mediaErr) return errResult(mediaErr);
  try {
    applyMcpContentMediaInput(rowPatch, {
      is_video: isVideo,
      visual_format: visualFormat,
      media: [],
      media_kind: mediaKind,
      platforms: rowPatch.platforms,
    });
  } catch (err: any) {
    return errResult(err?.message || "Invalid media URL");
  }

  const row = rowPatch;

  const { data, error } = await db
    .from("content_posts")
    .insert(row)
    .select("id")
    .single();
  if (error) return errResult(error.message);
  return toolGetContentPost(data.id as string);
}

export async function toolUploadContentPostMedia(input: {
  post_id: string;
  filename: string;
  content_base64: string;
  mime_type?: string | null;
  platform?: "shared" | "instagram" | "linkedin";
  attach?: boolean;
}) {
  if (!isUuid(input.post_id)) return errResult("post_id must be a UUID.");
  if (!input.filename?.trim()) return errResult("filename is required.");
  if (!input.content_base64?.trim()) return errResult("content_base64 is required.");

  let bytes: Buffer;
  try {
    bytes = Buffer.from(input.content_base64.trim(), "base64");
  } catch {
    return errResult("content_base64 must be valid base64.");
  }

  const { uploadContentPostMediaBytes } = await import("@/lib/content/upload-post-media");
  const res = await uploadContentPostMediaBytes({
    postId: input.post_id,
    filename: input.filename,
    bytes,
    mimeType: input.mime_type,
    platform:
      input.platform === "instagram" || input.platform === "linkedin"
        ? input.platform
        : "shared",
    attach: input.attach !== false,
  });
  if (!res.ok) return errResult(res.error);

  if (input.attach !== false) {
    return toolGetContentPost(input.post_id);
  }

  return textResult({
    ok: true,
    url: res.url,
    storage_path: res.path,
    media_item: res.item,
    hint: "Attached=false — call update_content_post with this url or re-run with attach=true.",
  });
}

export async function toolGenerateContentMonth(input: {
  project_id: string;
  step: "angles" | "full" | "post_angle" | "post_full";
  period_start?: string;
  theme_notes?: string | null;
  post_id?: string;
  replace?: boolean;
  regenerate_drafts?: boolean;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  const { data: project } = await db.from("projects").select("id").eq("id", input.project_id).maybeSingle();
  if (!project) return errResult("Project not found.");

  const { runContentMonthGeneration } = await import("@/lib/content/generate-month");
  const result = await runContentMonthGeneration(db, {
    step: input.step,
    projectId: input.project_id,
    periodStart: input.period_start,
    themeNotes: input.theme_notes || undefined,
    postId: input.post_id,
    replace: input.replace,
    regenerateDrafts: input.regenerate_drafts,
  });
  if (!result.ok) return errResult(result.error);
  return textResult(result);
}

export async function toolIngestContentMediaFromUrl(input: {
  post_id: string;
  url: string;
  filename?: string | null;
  platform?: "shared" | "instagram" | "linkedin";
  attach?: boolean;
}) {
  if (!isUuid(input.post_id)) return errResult("post_id must be a UUID.");
  if (!input.url?.trim()) return errResult("url is required.");

  const { ingestContentPostMediaFromUrl } = await import("@/lib/content/upload-post-media");
  const res = await ingestContentPostMediaFromUrl({
    postId: input.post_id,
    url: input.url.trim(),
    filename: input.filename,
    platform:
      input.platform === "instagram" || input.platform === "linkedin"
        ? input.platform
        : "shared",
    attach: input.attach !== false,
  });
  if (!res.ok) return errResult(res.error);

  if (input.attach !== false) {
    return toolGetContentPost(input.post_id);
  }

  return textResult({
    ok: true,
    url: res.url,
    storage_path: res.path,
    media_item: res.item,
    hint: "Attached=false — call update_content_post with this url or re-run with attach=true.",
  });
}

async function resolveContentCalendarId(input: {
  calendar_id?: string;
  project_id?: string;
  period_start?: string;
}) {
  const db = createAdminClient();
  if (input.calendar_id) {
    if (!isUuid(input.calendar_id)) return { error: "calendar_id must be a UUID." };
    const { data: cal, error } = await db
      .from("content_calendars")
      .select("id, project_id")
      .eq("id", input.calendar_id)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!cal) return { error: "Calendar not found." };
    return { calendarId: cal.id as string, projectId: cal.project_id as string };
  }
  if (input.project_id && input.period_start) {
    if (!isUuid(input.project_id)) return { error: "project_id must be a UUID." };
    const raw = input.period_start.slice(0, 10);
    const ps = raw.length === 7 ? `${raw}-01` : raw;
    const { ensureCalendar } = await import("@/lib/content/load");
    const cal = await ensureCalendar(db, input.project_id, ps);
    return { calendarId: cal.id, projectId: input.project_id };
  }
  return { error: "Provide calendar_id, or project_id + period_start." };
}

export async function toolApproveAllContentAngles(input: {
  calendar_id?: string;
  project_id?: string;
  period_start?: string;
}) {
  const resolved = await resolveContentCalendarId(input);
  if ("error" in resolved && resolved.error) return errResult(resolved.error);
  const db = createAdminClient();
  const { error } = await db
    .from("content_posts")
    .update({ angle_approved: true, updated_at: new Date().toISOString() })
    .eq("calendar_id", resolved.calendarId!)
    .eq("locked", false);
  if (error) return errResult(error.message);
  return textResult({
    ok: true,
    calendar_id: resolved.calendarId,
    project_id: resolved.projectId,
    action: "approve_all_angles",
  });
}

export async function toolApproveAllContentPosts(input: {
  calendar_id?: string;
  project_id?: string;
  period_start?: string;
}) {
  const resolved = await resolveContentCalendarId(input);
  if ("error" in resolved && resolved.error) return errResult(resolved.error);
  const db = createAdminClient();
  const now = new Date().toISOString();

  const { error: upErr } = await db
    .from("content_posts")
    .update({
      status_approval: "approved",
      locked: true,
      angle_approved: true,
      updated_at: now,
    })
    .eq("calendar_id", resolved.calendarId!)
    .in("status_approval", ["needs_review", "draft", "on_hold"]);
  if (upErr) return errResult(upErr.message);

  const { error: calErr } = await db
    .from("content_calendars")
    .update({ status: "approved", updated_at: now })
    .eq("id", resolved.calendarId!);
  if (calErr) return errResult(calErr.message);

  return textResult({
    ok: true,
    calendar_id: resolved.calendarId,
    project_id: resolved.projectId,
    action: "approve_all_posts",
  });
}

/** ---------- Blog write ---------- */

const BLOG_STATUSES = [
  "researching",
  "brief",
  "draft",
  "optimizing",
  "ready",
  "scheduled",
  "published",
  "failed",
  "refresh",
] as const;

export async function toolUpsertBlogArticle(input: {
  id?: string;
  project_id: string;
  title?: string;
  slug?: string | null;
  status?: string;
  scheduled_for?: string | null;
  published_url?: string | null;
  client_visible?: boolean;
  language?: string | null;
  meta_description?: string | null;
  body_md?: string | null;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  if (input.status && !(BLOG_STATUSES as readonly string[]).includes(input.status)) {
    return errResult(
      "status must be researching|brief|draft|optimizing|ready|scheduled|published|failed|refresh."
    );
  }
  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .maybeSingle();
  if (!project) return errResult("Project not found.");

  const now = new Date().toISOString();

  if (input.id) {
    if (!isUuid(input.id)) return errResult("id must be a UUID.");
    const patch: Record<string, unknown> = { updated_at: now };
    if (input.title !== undefined) {
      const t = String(input.title || "").trim();
      if (!t) return errResult("title cannot be empty.");
      patch.title = t;
    }
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "published") patch.published_at = now;
    }
    if (input.scheduled_for !== undefined) patch.scheduled_for = input.scheduled_for;
    if (input.published_url !== undefined) patch.published_url = input.published_url;
    if (input.client_visible !== undefined) {
      patch.client_visible = Boolean(input.client_visible);
    }
    if (input.language !== undefined) patch.language = input.language;
    if (input.meta_description !== undefined) {
      patch.meta_description = input.meta_description;
    }
    if (input.body_md !== undefined) patch.body_md = input.body_md;
    if (Object.keys(patch).length === 1) {
      return errResult("Provide at least one field to update.");
    }
    const { error } = await db.from("blog_articles").update(patch).eq("id", input.id);
    if (error) return errResult(error.message);
    return toolGetBlogArticle(input.id);
  }

  const title = String(input.title || "").trim();
  if (!title) return errResult("title is required when creating.");
  const row: Record<string, unknown> = {
    project_id: input.project_id,
    title,
    slug: input.slug ?? null,
    status: input.status || "draft",
    pipeline_stage: "draft",
    scheduled_for: input.scheduled_for ?? null,
    published_url: input.published_url ?? null,
    client_visible: input.client_visible !== undefined ? Boolean(input.client_visible) : true,
    language: input.language ?? "en",
    meta_description: input.meta_description ?? null,
    body_md: input.body_md ?? null,
    updated_at: now,
  };
  if (input.status === "published") row.published_at = now;

  const { data, error } = await db
    .from("blog_articles")
    .insert(row)
    .select("id")
    .single();
  if (error) return errResult(error.message);
  return toolGetBlogArticle(data.id as string);
}

/** ---------- Published reports ---------- */

export async function toolListPublishedReports(projectId: string) {
  if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("published_reports")
    .select("id, project_id, category, status, published_at, updated_at, updated_by")
    .eq("project_id", projectId)
    .order("category");
  if (error) return errResult(error.message);
  return textResult({ reports: data || [], count: (data || []).length });
}

export async function toolGetPublishedReport(reportId: string) {
  if (!isUuid(reportId)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("published_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error) return errResult(error.message);
  if (!data) return errResult("Report not found.");
  return textResult({ report: data });
}

export async function toolUpsertPublishedReport(input: {
  project_id: string;
  category: string;
  status: "draft" | "published";
  config?: Record<string, unknown> | null;
}) {
  if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
  const { isReportCategory, REPORT_CATEGORIES } = await import(
    "@/lib/reports/categories"
  );
  if (!isReportCategory(input.category)) {
    return errResult(
      `category must be one of: ${REPORT_CATEGORIES.join(", ")}.`
    );
  }
  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .maybeSingle();
  if (!project) return errResult("Project not found.");

  const { publishConfigVersion } = await import("@/lib/reports/publish");
  const now = new Date().toISOString();
  const payload = {
    project_id: input.project_id,
    category: input.category,
    status: input.status,
    published_at: input.status === "published" ? now : null,
    updated_by: null as string | null,
    config: input.config ?? {
      version: publishConfigVersion(input.category),
      saved_at: now,
      source: "mcp",
    },
  };

  const { data, error } = await db
    .from("published_reports")
    .upsert(payload, { onConflict: "project_id, category" })
    .select("*")
    .single();
  if (error) return errResult(error.message);
  return textResult({ report: data });
}

/** ---------- Guidelines / SEO / SOW ---------- */

export async function toolListGuidelines(projectId: string) {
  if (!isUuid(projectId)) return errResult("project_id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("ci_guidelines")
    .select("id, project_id, slug, status, published_at, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) return errResult(error.message);
  return textResult({ guidelines: data || [], count: (data || []).length });
}

export async function toolGetGuideline(guidelineId: string) {
  if (!isUuid(guidelineId)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("ci_guidelines")
    .select("id, project_id, slug, status, theme, published_at, updated_at, created_at")
    .eq("id", guidelineId)
    .maybeSingle();
  if (error) return errResult(error.message);
  if (!data) return errResult("Guideline not found.");
  return textResult({ guideline: data });
}

export async function toolUpdateGuideline(input: {
  id: string;
  status?: "draft" | "published";
  slug?: string | null;
  theme?: Record<string, unknown> | null;
}) {
  if (!isUuid(input.id)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.published_at =
      input.status === "published" ? new Date().toISOString() : null;
  }
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.theme !== undefined) patch.theme = input.theme;
  if (Object.keys(patch).length === 1) {
    return errResult("Provide status, slug, and/or theme.");
  }
  const { data, error } = await db
    .from("ci_guidelines")
    .update(patch)
    .eq("id", input.id)
    .select("id, project_id, slug, status, published_at, updated_at")
    .single();
  if (error) return errResult(error.message);
  return textResult({ guideline: data });
}

export async function toolListSeoSites(input: {
  project_id?: string;
  company_id?: string;
}) {
  if (!input.project_id && !input.company_id) {
    return errResult("Provide project_id or company_id.");
  }
  const db = createAdminClient();
  let q = db
    .from("seo_sites")
    .select(
      "id, domain, url, label, company_id, project_id, is_client_visible, last_run_at, last_score, updated_at"
    )
    .order("domain");
  if (input.project_id) {
    if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
    q = q.eq("project_id", input.project_id);
  }
  if (input.company_id) {
    if (!isUuid(input.company_id)) return errResult("company_id must be a UUID.");
    q = q.eq("company_id", input.company_id);
  }
  const { data, error } = await q.limit(100);
  if (error) return errResult(error.message);
  return textResult({ sites: data || [], count: (data || []).length });
}

export async function toolUpdateSeoSite(input: {
  id: string;
  is_client_visible?: boolean;
  label?: string | null;
  domain?: string;
  url?: string;
}) {
  if (!isUuid(input.id)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.is_client_visible !== undefined) {
    patch.is_client_visible = Boolean(input.is_client_visible);
  }
  if (input.label !== undefined) patch.label = input.label;
  if (input.domain !== undefined) {
    const d = String(input.domain || "").trim();
    if (!d) return errResult("domain cannot be empty.");
    patch.domain = d;
  }
  if (input.url !== undefined) {
    const u = String(input.url || "").trim();
    if (!u) return errResult("url cannot be empty.");
    patch.url = u;
  }
  if (Object.keys(patch).length === 1) {
    return errResult("Provide at least one field to update.");
  }
  const { data, error } = await db
    .from("seo_sites")
    .update(patch)
    .eq("id", input.id)
    .select(
      "id, domain, url, label, company_id, project_id, is_client_visible, last_run_at, last_score, updated_at"
    )
    .single();
  if (error) return errResult(error.message);
  return textResult({ site: data });
}

export async function toolGetSeoRun(input: {
  site_id: string;
  run_id?: string;
}) {
  if (!isUuid(input.site_id)) return errResult("site_id must be a UUID.");
  const db = createAdminClient();
  if (input.run_id) {
    if (!isUuid(input.run_id)) return errResult("run_id must be a UUID.");
    const { data, error } = await db
      .from("seo_runs")
      .select(
        "id, site_id, status, phase, scores, summary, public_slug, started_at, finished_at, created_at"
      )
      .eq("id", input.run_id)
      .eq("site_id", input.site_id)
      .maybeSingle();
    if (error) return errResult(error.message);
    if (!data) return errResult("Run not found.");
    return textResult({ run: data });
  }
  const { data, error } = await db
    .from("seo_runs")
    .select(
      "id, site_id, status, phase, scores, summary, public_slug, started_at, finished_at, created_at"
    )
    .eq("site_id", input.site_id)
    .eq("status", "ready")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return errResult(error.message);
  if (!data) return errResult("No ready SEO run for this site.");
  return textResult({ run: data });
}

export async function toolListSows(input: {
  project_id?: string;
  company_id?: string;
}) {
  if (!input.project_id && !input.company_id) {
    return errResult("Provide project_id or company_id.");
  }
  const db = createAdminClient();
  let q = db
    .from("sows")
    .select(
      "id, title, status, company_id, project_id, public_slug, published_at, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (input.project_id) {
    if (!isUuid(input.project_id)) return errResult("project_id must be a UUID.");
    q = q.eq("project_id", input.project_id);
  }
  if (input.company_id) {
    if (!isUuid(input.company_id)) return errResult("company_id must be a UUID.");
    q = q.eq("company_id", input.company_id);
  }
  const { data, error } = await q.limit(100);
  if (error) return errResult(error.message);
  return textResult({ sows: data || [], count: (data || []).length });
}

export async function toolGetSow(sowId: string) {
  if (!isUuid(sowId)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const { data, error } = await loadSowDocument(
    sowId,
    db as unknown as Awaited<ReturnType<typeof import("@/utils/supabase/server").createClient>>
  );
  if (error || !data) return errResult(error || "SOW not found.");
  return textResult({ sow: data });
}

export async function toolCreateSow(input: {
  company_id: string;
  title?: string;
  project_id?: string;
  package_id?: string;
  service_ids?: string[];
  context_text?: string;
  version_of_id?: string;
}) {
  if (!isUuid(input.company_id)) return errResult("company_id must be a UUID.");
  if (input.project_id && !isUuid(input.project_id)) {
    return errResult("project_id must be a UUID.");
  }
  if (input.package_id && !isUuid(input.package_id)) {
    return errResult("package_id must be a UUID.");
  }
  if (input.version_of_id && !isUuid(input.version_of_id)) {
    return errResult("version_of_id must be a UUID.");
  }
  if (input.service_ids?.some((id) => !isUuid(id))) {
    return errResult("Each service_ids entry must be a UUID.");
  }

  const db = createAdminClient();
  const { data: founder } = await db
    .from("profiles")
    .select("id")
    .in("role", ["superadmin", "admin"])
    .limit(1)
    .maybeSingle();

  const result = await createSowCore(db, {
    companyId: input.company_id,
    title: input.title,
    packageId: input.package_id ?? null,
    serviceIds: input.service_ids,
    contextText: input.context_text ?? null,
    versionOfId: input.version_of_id ?? null,
    projectId: input.project_id ?? null,
    createdBy: null,
    ownerId: founder?.id ?? null,
  });
  if (!result.ok) return errResult(result.error);
  return textResult({ sow: result.sow });
}

export async function toolUpsertSowLineItem(input: {
  id: string;
  title?: string;
  description?: string | null;
  price?: number | null;
  quantity_label?: string | null;
  cadence?: string | null;
  is_recurring?: boolean;
  sort_order?: number;
}) {
  if (!isUuid(input.id)) return errResult("id must be a UUID.");

  const db = createAdminClient();
  const { data: item, error: itemErr } = await db
    .from("sow_line_items")
    .select("id, sow_id, section_id, title, description, price, quantity_label, cadence, is_recurring, sort_order")
    .eq("id", input.id)
    .maybeSingle();
  if (itemErr) return errResult(itemErr.message);
  if (!item) return errResult("Line item not found.");

  const { data: sow } = await db
    .from("sows")
    .select("status, public_slug")
    .eq("id", item.sow_id)
    .maybeSingle();
  if (sow?.status === "accepted") {
    return errResult("Accepted SOWs cannot be edited.");
  }

  const gate = await assertSowWritable(db, item.sow_id);
  if (!gate.ok) return errResult(gate.error);

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const t = String(input.title).trim();
    if (!t) return errResult("title cannot be empty.");
    patch.title = t;
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.price !== undefined) patch.price = input.price;
  if (input.quantity_label !== undefined) patch.quantity_label = input.quantity_label;
  if (input.cadence !== undefined) patch.cadence = input.cadence;
  if (input.is_recurring !== undefined) patch.is_recurring = input.is_recurring;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  if (Object.keys(patch).length === 0) {
    return errResult("Provide at least one field to update.");
  }

  const { data: updated, error: updErr } = await db
    .from("sow_line_items")
    .update(patch)
    .eq("id", input.id)
    .select(
      "id, sow_id, section_id, title, description, price, quantity_label, cadence, is_recurring, sort_order"
    )
    .single();
  if (updErr) return errResult(updErr.message);

  try {
    const { applySowDealValue } = await import("@/lib/accounting/deal-value");
    await applySowDealValue(item.sow_id);
  } catch {
    /* finance sync is best-effort */
  }

  return textResult({ line_item: updated });
}

export async function toolUpdateSow(input: {
  id: string;
  status?: "draft" | "published" | "accepted" | "archived";
  title?: string;
}) {
  if (!isUuid(input.id)) return errResult("id must be a UUID.");
  const db = createAdminClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "published") {
      patch.published_at = new Date().toISOString();
    }
  }
  if (input.title !== undefined) {
    const t = String(input.title || "").trim();
    if (!t) return errResult("title cannot be empty.");
    patch.title = t;
  }
  if (Object.keys(patch).length === 1) {
    return errResult("Provide status and/or title.");
  }
  const { data, error } = await db
    .from("sows")
    .update(patch)
    .eq("id", input.id)
    .select(
      "id, title, status, company_id, project_id, public_slug, published_at, updated_at"
    )
    .single();
  if (error) return errResult(error.message);
  return textResult({ sow: data });
}

export { parseGlobalTaskPolicy };
