import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { loadProjectForPropose } from "@/lib/strategy/load";
import { loadContextDocs } from "@/lib/audience/load";
import { loadMarketAnalysis } from "@/lib/market/load";
import { syncMarketModuleStatus } from "@/lib/market/sync";
import {
  docsGuardrail,
  draftMarketAnalysis,
  draftMarketField,
  fieldMetaFromDrafts,
} from "@/lib/market/generate";
import { isMarketField } from "@/lib/market/types";
import { revalidatePath } from "next/cache";
import { workPaths } from "@/lib/work/paths";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Step = "draft" | "field";

function revalidate(projectId: string) {
  revalidatePath(workPaths.proposeMarket(projectId));
  revalidatePath(`/app/work/propose/${projectId}`, "layout");
}

export async function POST(req: Request) {
  const staff = await requireStaffUser();
  if ("error" in staff && staff.error) return staff.error;
  const supabase = staff.supabase as any;

  let body: {
    step?: Step;
    projectId?: string;
    field?: string;
    category?: string;
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
  if (!gate.ok) return NextResponse.json(gate);
  const unverified = gate.unverified;

  const existing = await loadMarketAnalysis(supabase, projectId);
  const category = (body.category ?? existing?.category ?? project.industry ?? "").trim();
  if (!category) {
    return NextResponse.json({
      ok: false,
      error: "Set a category (or fill industry on the CRM company) before generating.",
    });
  }

  try {
    if (step === "draft") {
      const drafted = await draftMarketAnalysis({
        company: project.company,
        projectTitle: project.title,
        category,
        docs,
        unverified,
      });
      if (!drafted.ok) return NextResponse.json(drafted);
      const fields = drafted.fields;
      const payload = {
        project_id: projectId,
        category,
        size_notes: fields.size_notes.text,
        trend_notes: fields.trend_notes.text,
        timing_notes: fields.timing_notes.text,
        risk_notes: fields.risk_notes.text,
        status: "draft",
        ai_generated: true,
        field_meta: fieldMetaFromDrafts(fields),
        updated_at: new Date().toISOString(),
      };
      if (existing?.id) {
        const { error } = await supabase
          .from("market_analysis")
          .update(payload)
          .eq("id", existing.id);
        if (error) return NextResponse.json({ ok: false, error: error.message });
      } else {
        const { error } = await supabase.from("market_analysis").insert(payload);
        if (error) return NextResponse.json({ ok: false, error: error.message });
      }
      await syncMarketModuleStatus(supabase, projectId);
      revalidate(projectId);
      return NextResponse.json({ ok: true, unverified });
    }

    if (step === "field") {
      if (!body.field || !isMarketField(body.field)) {
        return NextResponse.json({ ok: false, error: "field required" }, { status: 400 });
      }
      if (!existing) {
        return NextResponse.json({ ok: false, error: "Generate the full draft first" }, { status: 400 });
      }
      const drafted = await draftMarketField({
        company: project.company,
        projectTitle: project.title,
        category,
        field: body.field,
        docs,
        unverified,
      });
      if (!drafted.ok) return NextResponse.json(drafted);
      const meta = { ...(existing.fieldMeta || {}) };
      meta[body.field] = { origin: drafted.origin };
      const { error } = await supabase
        .from("market_analysis")
        .update({
          [body.field]: drafted.text,
          field_meta: meta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("project_id", projectId);
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
