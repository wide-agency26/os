/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/utils/supabase/admin";
import type { ContextBankPayload } from "@/lib/context-bank/types";

type Sb = { from: (table: string) => any };

export type LogToContextBankResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function emptyToNull(value?: string | null): string | null {
  const t = (value ?? "").trim();
  return t ? t : null;
}

/**
 * Single write path for Context Bank.
 *
 * Callers must not roll back their own action if this fails — wrap and log.
 * company_id is crm_customers.id for a company row (record_kind = company).
 * If a contact id is passed, it is resolved to parent_company_id.
 *
 * Document refs use source_table = 'content_context_docs' (existing upload
 * pool). project_context_docs was never built — do not create a second table.
 */
export async function logToContextBank(
  payload: ContextBankPayload,
  client?: Sb
): Promise<LogToContextBankResult> {
  try {
    const supabase = (client ?? createAdminClient()) as any;
    const content = (payload.content ?? "").trim();
    if (!content) return { ok: false, error: "Content is required" };
    const entryType = (payload.entry_type ?? "").trim();
    if (!entryType) return { ok: false, error: "entry_type is required" };

    let sourceTable = emptyToNull(payload.source_table);
    let sourceId = emptyToNull(payload.source_id);
    if ((sourceTable && !sourceId) || (!sourceTable && sourceId)) {
      return { ok: false, error: "source_table and source_id must be set together" };
    }

    let companyId = payload.company_id;
    if (!companyId) return { ok: false, error: "company_id is required" };

    const { data: company, error: companyErr } = await supabase
      .from("crm_customers")
      .select("id, record_kind, parent_company_id")
      .eq("id", companyId)
      .maybeSingle();
    if (companyErr) return { ok: false, error: companyErr.message };
    if (!company) return { ok: false, error: "Company not found" };
    if (company.record_kind === "contact") {
      if (!company.parent_company_id) {
        return { ok: false, error: "Contact has no parent company" };
      }
      companyId = company.parent_company_id;
    } else if (company.record_kind && company.record_kind !== "company") {
      return { ok: false, error: "company_id must be a company CRM row" };
    }

    let projectId = emptyToNull(payload.project_id);
    if (projectId) {
      const { data: project, error: projectErr } = await supabase
        .from("projects")
        .select("id, client_id")
        .eq("id", projectId)
        .maybeSingle();
      if (projectErr) return { ok: false, error: projectErr.message };
      if (!project) return { ok: false, error: "Project not found" };
      if (project.client_id !== companyId) {
        companyId = project.client_id;
      }
    }

    const { data, error } = await supabase
      .from("context_entries")
      .insert({
        company_id: companyId,
        project_id: projectId,
        entry_type: entryType,
        source_type: emptyToNull(payload.source_type),
        source_table: sourceTable,
        source_id: sourceId,
        title: emptyToNull(payload.title),
        content,
        is_system_generated: payload.is_system_generated !== false,
        created_by: emptyToNull(payload.created_by),
      })
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data?.id) return { ok: false, error: "Insert returned no id" };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Context Bank write failed" };
  }
}
