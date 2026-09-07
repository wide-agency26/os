/* eslint-disable @typescript-eslint/no-explicit-any */
import { SENTIMENT_MODULE_KEY } from "@/lib/strategy/modules";
import { sentimentStatusFromReport } from "@/lib/sentiment/strategy";
import {
  ensureProjectSentimentLink,
  loadProjectSentimentReport,
} from "@/lib/sentiment/load-project";

type Sb = any;

async function writeModuleStatus(supabase: Sb, projectId: string, status: string) {
  const { data: scopes } = await supabase.from("scopes").select("id").eq("project_id", projectId);
  const scopeIds = (scopes ?? []).map((s: { id: string }) => s.id);
  if (!scopeIds.length) return status;

  const { data: strategies } = await supabase
    .from("strategies")
    .select("id")
    .in("scope_id", scopeIds);
  const strategyIds = (strategies ?? []).map((s: { id: string }) => s.id);
  if (!strategyIds.length) return status;

  await supabase
    .from("strategy_modules")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("module_key", SENTIMENT_MODULE_KEY)
    .in("strategy_id", strategyIds);

  for (const sid of strategyIds) {
    const { data: mods } = await supabase
      .from("strategy_modules")
      .select("status")
      .eq("strategy_id", sid);
    const list = mods ?? [];
    const allFinal =
      list.length > 0 && list.every((m: { status: string }) => m.status === "finalized");
    const anyStarted = list.some((m: { status: string }) => m.status !== "not_started");
    const next = allFinal ? "finalized" : anyStarted ? "in_progress" : "draft";
    await supabase
      .from("strategies")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", sid);
  }
  return status;
}

/** Mirror /app/sentiment completion onto every sentiment-analysis slot on this project. */
export async function syncSentimentModuleStatus(supabase: Sb, projectId: string) {
  const { data: project } = await supabase
    .from("projects")
    .select("id, bd_record_id, crm_customers:client_id ( record_kind, company, name, website, parent:parent_company_id ( company, name, website ) )")
    .eq("id", projectId)
    .maybeSingle();

  let report = null;
  if (project) {
    const client = Array.isArray(project.crm_customers)
      ? project.crm_customers[0]
      : project.crm_customers;
    const parent = Array.isArray(client?.parent) ? client?.parent[0] : client?.parent;
    const companyRow = client?.record_kind === "contact" && parent ? parent : client;
    report = await ensureProjectSentimentLink(supabase, {
      id: projectId,
      company: companyRow?.company || companyRow?.name || client?.company || client?.name || "",
      website: companyRow?.website || client?.website || null,
      bdRecordId: project.bd_record_id ?? null,
    });
  } else {
    report = await loadProjectSentimentReport(supabase, projectId);
  }

  const status = sentimentStatusFromReport(report);
  return writeModuleStatus(supabase, projectId, status);
}
