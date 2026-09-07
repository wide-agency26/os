/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { loadProjectForPropose, loadStrategy } from "@/lib/strategy/load";
import { collectPositioningContext } from "@/lib/positioning/inputs";
import { draftPositioning } from "@/lib/positioning/generate";
import { inputsUsedToJson, loadPositioning } from "@/lib/positioning/load";
import { syncPositioningModuleStatus } from "@/lib/positioning/sync";
import { revalidatePath } from "next/cache";
import { workPaths } from "@/lib/work/paths";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staff = await requireStaffUser();
  if ("error" in staff && staff.error) return staff.error;
  const supabase = staff.supabase as any;

  let body: { projectId?: string; scopeId?: string; strategyId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId;
  const scopeId = body.scopeId;
  const strategyId = body.strategyId;
  if (!projectId || !scopeId || !strategyId) {
    return NextResponse.json(
      { ok: false, error: "projectId, scopeId, and strategyId required" },
      { status: 400 }
    );
  }

  const [project, strategy] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadStrategy(supabase, strategyId),
  ]);
  if (!project || !strategy || strategy.scopeId !== scopeId) {
    return NextResponse.json({ ok: false, error: "Strategy not found" }, { status: 404 });
  }

  const ctx = await collectPositioningContext(supabase, projectId, strategyId);
  if ("ok" in ctx && ctx.ok === false) {
    return NextResponse.json(ctx);
  }
  if (!("gate" in ctx)) {
    return NextResponse.json({ ok: false, error: "Could not evaluate inputs" });
  }
  if (!ctx.gate.canGenerate) {
    return NextResponse.json({ ok: false, error: ctx.gate.reason, gate: ctx.gate });
  }

  const existing = await loadPositioning(supabase, strategyId);
  const drafted = await draftPositioning({
    company: project.company,
    projectTitle: project.title,
    strategyType: ctx.strategyType,
    pack: ctx.pack,
    previousStatement: existing?.statement,
    previousRationale: existing?.rationale,
  });
  if (!drafted.ok) return NextResponse.json(drafted);

  const now = new Date().toISOString();
  const payload = {
    strategy_id: strategyId,
    positioning_statement: drafted.statement,
    rationale: drafted.rationale,
    inputs_used: inputsUsedToJson(ctx.inputsUsed),
    status: "draft",
    ai_generated: true,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("strategy_positioning")
      .update(payload)
      .eq("id", existing.id)
      .eq("strategy_id", strategyId);
    if (error) return NextResponse.json({ ok: false, error: error.message });
  } else {
    const { error } = await supabase.from("strategy_positioning").insert(payload);
    if (error) return NextResponse.json({ ok: false, error: error.message });
  }

  await syncPositioningModuleStatus(supabase, strategyId);
  revalidatePath(workPaths.proposePositioning(projectId, scopeId, strategyId));
  revalidatePath(workPaths.proposeBuilder(projectId, scopeId, strategyId));
  revalidatePath(workPaths.proposeShare(projectId, scopeId, strategyId));

  return NextResponse.json({
    ok: true,
    statement: drafted.statement,
    inputs: Object.keys(ctx.inputsUsed),
  });
}
