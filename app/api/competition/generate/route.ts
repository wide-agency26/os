/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { loadProjectForPropose } from "@/lib/strategy/load";
import { loadContextDocs } from "@/lib/audience/load";
import { loadCompetitionSynthesis, loadCompetitors, mapCompetitor } from "@/lib/competition/load";
import { fetchCompetitorSite } from "@/lib/competition/fetch-site";
import {
  draftCompetitionSynthesis,
  draftCompetitorEnrichment,
  fieldMetaFromDrafts,
} from "@/lib/competition/generate";
import { syncCompetitionModuleStatus } from "@/lib/competition/sync";
import { revalidatePath } from "next/cache";
import { workPaths } from "@/lib/work/paths";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Step = "enrich" | "synthesis";

function revalidate(projectId: string) {
  revalidatePath(workPaths.proposeCompetition(projectId));
  revalidatePath(workPaths.proposeProject(projectId));
  revalidatePath(`/app/work/propose/${projectId}`, "layout");
}

export async function POST(req: Request) {
  const staff = await requireStaffUser();
  if ("error" in staff && staff.error) return staff.error;
  const supabase = staff.supabase as any;

  let body: { step?: Step; projectId?: string; competitorId?: string };
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

  try {
    if (step === "enrich") {
      if (!body.competitorId) {
        return NextResponse.json({ ok: false, error: "competitorId required" }, { status: 400 });
      }
      const { data: row } = await supabase
        .from("competitors")
        .select("*")
        .eq("id", body.competitorId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!row) return NextResponse.json({ ok: false, error: "Competitor not found" }, { status: 404 });
      const competitor = mapCompetitor(row);
      const site = competitor.url ? await fetchCompetitorSite(competitor.url) : null;
      const drafted = await draftCompetitorEnrichment({
        company: project.company,
        projectTitle: project.title,
        competitorName: competitor.name,
        competitorUrl: competitor.url,
        notes: competitor.notes,
        site,
        docs,
      });
      if (!drafted.ok) return NextResponse.json(drafted);
      const fields = drafted.fields;
      const { error } = await supabase
        .from("competitors")
        .update({
          positioning_summary: fields.positioning_summary.text,
          messaging_notes: fields.messaging_notes.text,
          channels_notes: fields.channels_notes.text,
          strengths: fields.strengths.text,
          weaknesses: fields.weaknesses.text,
          field_meta: fieldMetaFromDrafts(fields, site && !site.ok ? site.error : undefined),
          ai_generated: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", competitor.id);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      revalidate(projectId);
      return NextResponse.json({
        ok: true,
        fetchOk: Boolean(site?.ok),
        fetchError: site && !site.ok ? site.error : null,
      });
    }

    if (step === "synthesis") {
      const competitors = await loadCompetitors(supabase, projectId);
      const accepted = competitors.filter((c) => c.accepted);
      if (!accepted.length) {
        return NextResponse.json({
          ok: false,
          error: "Accept at least one competitor before generating the gaps note.",
        });
      }
      const drafted = await draftCompetitionSynthesis({
        company: project.company,
        projectTitle: project.title,
        competitors: accepted,
        docs,
      });
      if (!drafted.ok) return NextResponse.json(drafted);
      const existing = await loadCompetitionSynthesis(supabase, projectId);
      const payload = {
        project_id: projectId,
        gaps_and_opportunities: drafted.text,
        status: "draft",
        ai_generated: true,
        updated_at: new Date().toISOString(),
      };
      if (existing?.id) {
        const { error } = await supabase
          .from("competition_synthesis")
          .update(payload)
          .eq("id", existing.id);
        if (error) return NextResponse.json({ ok: false, error: error.message });
      } else {
        const { error } = await supabase.from("competition_synthesis").insert(payload);
        if (error) return NextResponse.json({ ok: false, error: error.message });
      }
      await syncCompetitionModuleStatus(supabase, projectId);
      revalidate(projectId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown step" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Generation failed",
    });
  }
}
