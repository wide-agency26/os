/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ContextDoc } from "@/lib/content/types";
import {
  isProfileField,
  type AudienceProfile,
  type AudienceSegment,
  type AudienceSource,
  type FieldMeta,
  type ProfileField,
} from "@/lib/audience/types";

type Sb = any;

function mapMeta(raw: unknown): Partial<Record<ProfileField, FieldMeta>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<ProfileField, FieldMeta>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, any>)) {
    if (!isProfileField(k)) continue;
    const origin = v?.origin === "inferred" ? "inferred" : "sourced";
    out[k] = { origin };
  }
  return out;
}

function mapProfile(row: any): AudienceProfile {
  return {
    id: row.id,
    segmentId: row.segment_id,
    pains: row.pains ?? "",
    motivations: row.motivations ?? "",
    channelHabits: row.channel_habits ?? "",
    languageCues: row.language_cues ?? "",
    objections: row.objections ?? "",
    triggers: row.triggers ?? "",
    status: row.status === "finalized" ? "finalized" : "draft",
    aiGenerated: Boolean(row.ai_generated),
    fieldMeta: mapMeta(row.field_meta),
  };
}

export function mapSegment(row: any, profile: AudienceProfile | null): AudienceSegment {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    demographicSummary: row.demographic_summary ?? "",
    sizeOrValue: row.size_or_value ?? "",
    rationale: row.rationale ?? "",
    status: row.status === "finalized" ? "finalized" : "draft",
    accepted: Boolean(row.accepted),
    aiGenerated: Boolean(row.ai_generated),
    sortOrder: row.sort_order ?? 0,
    profile,
  };
}

export async function loadContextDocs(supabase: Sb, projectId: string): Promise<ContextDoc[]> {
  const { data } = await supabase
    .from("content_context_docs")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });
  return (data ?? []) as ContextDoc[];
}

export async function loadAudienceSegments(
  supabase: Sb,
  projectId: string
): Promise<AudienceSegment[]> {
  const { data: segs } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("created_at");
  const ids = (segs ?? []).map((s: any) => s.id);
  if (!ids.length) return [];
  const { data: profiles } = await supabase
    .from("audience_insight_profiles")
    .select("*")
    .in("segment_id", ids);
  const bySeg = new Map<string, AudienceProfile>(
    (profiles ?? []).map((p: any) => [String(p.segment_id), mapProfile(p)])
  );
  return (segs ?? []).map((row: any) => mapSegment(row, bySeg.get(row.id) ?? null));
}

export async function loadAudienceSources(
  supabase: Sb,
  segmentIds: string[]
): Promise<AudienceSource[]> {
  if (!segmentIds.length) return [];
  const { data } = await supabase
    .from("audience_insight_sources")
    .select(
      "id, segment_id, profile_id, context_doc_id, field_name, note, content_context_docs:context_doc_id ( filename )"
    )
    .in("segment_id", segmentIds);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    segmentId: row.segment_id ?? null,
    profileId: row.profile_id ?? null,
    contextDocId: row.context_doc_id,
    fieldName: row.field_name ?? null,
    note: row.note ?? null,
    filename: Array.isArray(row.content_context_docs)
      ? row.content_context_docs[0]?.filename
      : row.content_context_docs?.filename,
  }));
}
