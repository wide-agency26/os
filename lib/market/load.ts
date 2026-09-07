/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  isMarketField,
  type MarketAnalysis,
  type MarketField,
  type FieldMeta,
} from "@/lib/market/types";

type Sb = any;

function mapMeta(raw: unknown): Partial<Record<MarketField, FieldMeta>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<MarketField, FieldMeta>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, any>)) {
    if (!isMarketField(k)) continue;
    out[k] = { origin: v?.origin === "inferred" ? "inferred" : "sourced" };
  }
  return out;
}

export function mapMarketAnalysis(row: any): MarketAnalysis {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category ?? "",
    sizeNotes: row.size_notes ?? "",
    trendNotes: row.trend_notes ?? "",
    timingNotes: row.timing_notes ?? "",
    riskNotes: row.risk_notes ?? "",
    status: row.status === "finalized" ? "finalized" : "draft",
    aiGenerated: Boolean(row.ai_generated),
    fieldMeta: mapMeta(row.field_meta),
  };
}

export async function loadMarketAnalysis(
  supabase: Sb,
  projectId: string
): Promise<MarketAnalysis | null> {
  const { data } = await supabase
    .from("market_analysis")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  return data ? mapMarketAnalysis(data) : null;
}
