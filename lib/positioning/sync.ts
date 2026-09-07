/* eslint-disable @typescript-eslint/no-explicit-any */
import { SYNTHESIS_MODULE_KEY } from "@/lib/strategy/modules";
import { positioningModuleStatus } from "@/lib/positioning/types";
import { loadPositioning } from "@/lib/positioning/load";

type Sb = any;

/** Writes strategy_modules.status for synthesis-positioning on this strategy only. */
export async function syncPositioningModuleStatus(supabase: Sb, strategyId: string) {
  const row = await loadPositioning(supabase, strategyId);
  const status = positioningModuleStatus(row);

  await supabase
    .from("strategy_modules")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("module_key", SYNTHESIS_MODULE_KEY)
    .eq("strategy_id", strategyId);

  const { data: mods } = await supabase
    .from("strategy_modules")
    .select("status")
    .eq("strategy_id", strategyId);
  const list = mods ?? [];
  const allFinal =
    list.length > 0 && list.every((m: { status: string }) => m.status === "finalized");
  const anyStarted = list.some((m: { status: string }) => m.status !== "not_started");
  const next = allFinal ? "finalized" : anyStarted ? "in_progress" : "draft";
  await supabase
    .from("strategies")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", strategyId);

  return status;
}
