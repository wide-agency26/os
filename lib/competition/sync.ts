/* eslint-disable @typescript-eslint/no-explicit-any */
import { COMPETITION_MODULE_KEY } from "@/lib/strategy/modules";
import { competitionModuleStatus } from "@/lib/competition/types";
import { loadCompetitionSynthesis } from "@/lib/competition/load";

type Sb = any;

/** Writes strategy_modules.status for every competition-analysis slot on this project. */
export async function syncCompetitionModuleStatus(supabase: Sb, projectId: string) {
  const synthesis = await loadCompetitionSynthesis(supabase, projectId);
  const status = competitionModuleStatus(synthesis);

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
    .eq("module_key", COMPETITION_MODULE_KEY)
    .in("strategy_id", strategyIds);

  for (const sid of strategyIds) {
    const { data: mods } = await supabase
      .from("strategy_modules")
      .select("status")
      .eq("strategy_id", sid);
    const list = mods ?? [];
    const allFinal = list.length > 0 && list.every((m: { status: string }) => m.status === "finalized");
    const anyStarted = list.some((m: { status: string }) => m.status !== "not_started");
    const next = allFinal ? "finalized" : anyStarted ? "in_progress" : "draft";
    await supabase
      .from("strategies")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", sid);
  }

  return status;
}
