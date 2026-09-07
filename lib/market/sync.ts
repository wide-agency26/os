/* eslint-disable @typescript-eslint/no-explicit-any */
import { MARKET_MODULE_KEY } from "@/lib/strategy/modules";
import { marketModuleStatus } from "@/lib/market/types";
import { loadMarketAnalysis } from "@/lib/market/load";

type Sb = any;

/** Writes strategy_modules.status for every market-analysis slot on this project. */
export async function syncMarketModuleStatus(supabase: Sb, projectId: string) {
  const row = await loadMarketAnalysis(supabase, projectId);
  const status = marketModuleStatus(row);

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
    .eq("module_key", MARKET_MODULE_KEY)
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
