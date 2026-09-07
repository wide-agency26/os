import { blocksToPlainSummary } from "@/lib/pm/blocknote";

/** Full pm_tasks columns returned by get/create/update MCP tools. */
export const TASK_MCP_SELECT =
  "id, project_id, title, status, waiting_on, source, source_ref, last_evidence, description, content_blocks, client_content_blocks, retitle_count, phase_label, client_visible, assignee_person_id, last_activity_at, updated_at, created_at, sort_order";

export const TASK_LIST_COMPACT_SELECT =
  "id, project_id, title, status, waiting_on, assignee_person_id, last_activity_at, client_visible, phase_label, sort_order";

export function compactTaskRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    status: row.status,
    waiting_on: row.waiting_on ?? null,
    assignee_person_id: row.assignee_person_id ?? null,
    last_activity_at: row.last_activity_at ?? null,
    client_visible: row.client_visible ?? true,
    phase_label: row.phase_label ?? null,
    sort_order: row.sort_order ?? null,
  };
}

export function serializeTaskForMcp(row: Record<string, unknown>) {
  const internalPreview = blocksToPlainSummary(row.content_blocks);
  const clientPreview = blocksToPlainSummary(row.client_content_blocks);
  return {
    ...row,
    body_preview: internalPreview ? internalPreview.slice(0, 240) : null,
    client_body_preview: clientPreview ? clientPreview.slice(0, 240) : null,
  };
}
