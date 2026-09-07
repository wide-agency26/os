/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  SYNTHESIS_MODULE_KEY,
  isModuleKey,
  type ModuleKey,
} from "@/lib/strategy/modules";
import type {
  PositioningInputsUsed,
  StrategyPositioning,
} from "@/lib/positioning/types";

type Sb = any;

function mapInputs(raw: unknown): PositioningInputsUsed {
  if (!raw || typeof raw !== "object") return {};
  const out: PositioningInputsUsed = {};
  for (const [k, v] of Object.entries(raw as Record<string, any>)) {
    if (!isModuleKey(k)) continue;
    const finalizedAt = String(v?.finalizedAt || v?.finalized_at || "").trim();
    const label = String(v?.label || "").trim();
    if (!finalizedAt) continue;
    out[k as ModuleKey] = { finalizedAt, label: label || k };
  }
  return out;
}

export function mapPositioning(row: any): StrategyPositioning {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    statement: row.positioning_statement ?? "",
    rationale: row.rationale ?? "",
    inputsUsed: mapInputs(row.inputs_used),
    status: row.status === "finalized" ? "finalized" : "draft",
    aiGenerated: Boolean(row.ai_generated),
    updatedAt: row.updated_at,
  };
}

export async function loadPositioning(
  supabase: Sb,
  strategyId: string
): Promise<StrategyPositioning | null> {
  const { data } = await supabase
    .from("strategy_positioning")
    .select("*")
    .eq("strategy_id", strategyId)
    .maybeSingle();
  return data ? mapPositioning(data) : null;
}

export function inputsUsedToJson(inputs: PositioningInputsUsed) {
  const out: Record<string, { finalizedAt: string; label: string }> = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (!v) continue;
    out[k] = { finalizedAt: v.finalizedAt, label: v.label };
  }
  return out;
}
