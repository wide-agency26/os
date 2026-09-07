/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  isCompetitorField,
  type CompetitionSynthesis,
  type Competitor,
  type CompetitorField,
  type FieldMeta,
} from "@/lib/competition/types";

type Sb = any;

function mapMeta(raw: unknown): Partial<Record<CompetitorField, FieldMeta>> & {
  fetchError?: string;
} {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<CompetitorField, FieldMeta>> & { fetchError?: string } = {};
  for (const [k, v] of Object.entries(raw as Record<string, any>)) {
    if (k === "fetch" && v && typeof v === "object" && v.ok === false) {
      out.fetchError = String(v.error || "Fetch failed");
      continue;
    }
    if (!isCompetitorField(k)) continue;
    out[k] = { origin: v?.origin === "inferred" ? "inferred" : "sourced" };
  }
  return out;
}

export function mapCompetitor(row: any): Competitor {
  const meta = mapMeta(row.field_meta);
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    url: row.url ?? "",
    notes: row.notes ?? "",
    positioningSummary: row.positioning_summary ?? "",
    messagingNotes: row.messaging_notes ?? "",
    channelsNotes: row.channels_notes ?? "",
    strengths: row.strengths ?? "",
    weaknesses: row.weaknesses ?? "",
    status: row.status === "finalized" ? "finalized" : "draft",
    accepted: Boolean(row.accepted),
    aiGenerated: Boolean(row.ai_generated),
    fieldMeta: meta,
    fetchError: meta.fetchError,
    sortOrder: row.sort_order ?? 0,
  };
}

export function mapSynthesis(row: any): CompetitionSynthesis {
  return {
    id: row.id,
    projectId: row.project_id,
    gapsAndOpportunities: row.gaps_and_opportunities ?? "",
    status: row.status === "finalized" ? "finalized" : "draft",
    aiGenerated: Boolean(row.ai_generated),
  };
}

export async function loadCompetitors(
  supabase: Sb,
  projectId: string
): Promise<Competitor[]> {
  const { data } = await supabase
    .from("competitors")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []).map(mapCompetitor);
}

export async function loadCompetitionSynthesis(
  supabase: Sb,
  projectId: string
): Promise<CompetitionSynthesis | null> {
  const { data } = await supabase
    .from("competition_synthesis")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  return data ? mapSynthesis(data) : null;
}
