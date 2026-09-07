import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { loadProjectForPropose } from "@/lib/strategy/load";
import { loadAudienceSegments, loadContextDocs } from "@/lib/audience/load";
import { syncAudienceModuleStatus } from "@/lib/audience/sync";
import {
  docsGuardrail,
  draftAudienceSegments,
  draftInsightField,
  draftInsightProfile,
  fieldMetaFromDrafts,
} from "@/lib/audience/generate";
import { isProfileField, PROFILE_FIELDS } from "@/lib/audience/types";
import { revalidatePath } from "next/cache";
import { workPaths } from "@/lib/work/paths";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Step = "segments" | "profile" | "field";

function revalidate(projectId: string) {
  revalidatePath(workPaths.proposeAudience(projectId));
  revalidatePath(workPaths.proposeProject(projectId));
}

export async function POST(req: Request) {
  const staff = await requireStaffUser();
  if ("error" in staff && staff.error) return staff.error;
  const supabase = staff.supabase as any;

  let body: {
    step?: Step;
    projectId?: string;
    segmentId?: string;
    field?: string;
    allowUnverified?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId;
  const step = body.step;
  if (!projectId || !step) {
    return NextResponse.json({ ok: false, error: "step and projectId required" }, { status: 400 });
  }

  const project = await loadProjectForPropose(supabase, projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const docs = (await loadContextDocs(supabase, projectId)).filter((d) => d.active);
  const gate = docsGuardrail(docs.length, body.allowUnverified);
  if (!gate.ok) {
    return NextResponse.json(gate);
  }
  const unverified = gate.unverified;

  try {
    if (step === "segments") {
      const drafted = await draftAudienceSegments({
        company: project.company,
        projectTitle: project.title,
        docs,
        unverified,
      });
      if (!drafted.ok) return NextResponse.json(drafted);

      const { data: last } = await supabase
        .from("audience_segments")
        .select("sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      let order = last?.sort_order ?? 0;
      const inserted: string[] = [];
      for (const seg of drafted.segments) {
        order += 1;
        const { data, error } = await supabase
          .from("audience_segments")
          .insert({
            project_id: projectId,
            name: unverified ? `${seg.name} (unverified)` : seg.name,
            demographic_summary: seg.demographic_summary,
            size_or_value: seg.size_or_value,
            rationale: unverified
              ? `[Unverified — no research docs]\n${seg.rationale}`
              : seg.rationale,
            status: "draft",
            accepted: false,
            ai_generated: true,
            sort_order: order,
          })
          .select("id")
          .single();
        if (error || !data) {
          return NextResponse.json({ ok: false, error: error?.message || "Insert failed" });
        }
        inserted.push(data.id);
        if (docs.length) {
          await supabase.from("audience_insight_sources").insert(
            docs.map((d) => ({
              segment_id: data.id,
              context_doc_id: d.id,
              field_name: "segment",
              note: unverified ? "unverified" : "segment generation",
            }))
          );
        }
      }
      await syncAudienceModuleStatus(supabase, projectId);
      revalidate(projectId);
      return NextResponse.json({ ok: true, count: inserted.length, unverified });
    }

    if (step === "profile") {
      if (!body.segmentId) {
        return NextResponse.json({ ok: false, error: "segmentId required" }, { status: 400 });
      }
      const { data: segment } = await supabase
        .from("audience_segments")
        .select("*")
        .eq("id", body.segmentId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!segment) {
        return NextResponse.json({ ok: false, error: "Segment not found" }, { status: 404 });
      }
      if (!segment.accepted) {
        return NextResponse.json({
          ok: false,
          error: "Accept the segment before generating its insight profile.",
        });
      }
      const drafted = await draftInsightProfile({
        company: project.company,
        segmentName: segment.name,
        demographicSummary: segment.demographic_summary || "",
        rationale: segment.rationale || "",
        docs,
        unverified,
      });
      if (!drafted.ok) return NextResponse.json(drafted);

      const fields = drafted.fields;
      const payload = {
        segment_id: segment.id,
        pains: fields.pains.text,
        motivations: fields.motivations.text,
        channel_habits: fields.channel_habits.text,
        language_cues: fields.language_cues.text,
        objections: fields.objections.text,
        triggers: fields.triggers.text,
        status: "draft",
        ai_generated: true,
        field_meta: fieldMetaFromDrafts(fields),
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from("audience_insight_profiles")
        .select("id")
        .eq("segment_id", segment.id)
        .maybeSingle();
      let profileId: string;
      if (existing?.id) {
        const { error } = await supabase
          .from("audience_insight_profiles")
          .update(payload)
          .eq("id", existing.id);
        if (error) return NextResponse.json({ ok: false, error: error.message });
        profileId = existing.id;
      } else {
        const { data, error } = await supabase
          .from("audience_insight_profiles")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) {
          return NextResponse.json({ ok: false, error: error?.message || "Insert failed" });
        }
        profileId = data.id;
      }
      if (docs.length) {
        await supabase
          .from("audience_insight_sources")
          .delete()
          .eq("profile_id", profileId);
        await supabase.from("audience_insight_sources").insert(
          PROFILE_FIELDS.flatMap((field) =>
            docs.map((d) => ({
              segment_id: segment.id,
              profile_id: profileId,
              context_doc_id: d.id,
              field_name: field,
              note: fields[field].origin,
            }))
          )
        );
      }
      await syncAudienceModuleStatus(supabase, projectId);
      revalidate(projectId);
      return NextResponse.json({ ok: true, profileId, unverified });
    }

    if (step === "field") {
      if (!body.segmentId || !body.field || !isProfileField(body.field)) {
        return NextResponse.json({ ok: false, error: "segmentId and field required" }, { status: 400 });
      }
      const { data: segment } = await supabase
        .from("audience_segments")
        .select("id, name")
        .eq("id", body.segmentId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!segment) {
        return NextResponse.json({ ok: false, error: "Segment not found" }, { status: 404 });
      }
      const { data: profile } = await supabase
        .from("audience_insight_profiles")
        .select("id, field_meta")
        .eq("segment_id", segment.id)
        .maybeSingle();
      if (!profile) {
        return NextResponse.json({ ok: false, error: "Generate the full profile first" }, { status: 400 });
      }
      const drafted = await draftInsightField({
        company: project.company,
        segmentName: segment.name,
        field: body.field,
        docs,
        unverified,
      });
      if (!drafted.ok) return NextResponse.json(drafted);
      const meta = { ...(profile.field_meta || {}) };
      meta[body.field] = { origin: drafted.origin };
      const { error } = await supabase
        .from("audience_insight_profiles")
        .update({
          [body.field]: drafted.text,
          field_meta: meta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      revalidate(projectId);
      return NextResponse.json({ ok: true, unverified, origin: drafted.origin });
    }

    return NextResponse.json({ ok: false, error: "Unknown step" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Generation failed",
    });
  }
}
