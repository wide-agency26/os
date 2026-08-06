import { NextRequest, NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getValidFigmaAccessToken } from "@/lib/ci-builder/figma/connection";
import { FigmaApiError } from "@/lib/ci-builder/figma/client";
import {
  checkFigmaSyncStatus,
  runFigmaImportPipeline,
} from "@/lib/ci-builder/figma/pipeline";
import { applyImportResult } from "@/lib/ci-builder/import/apply-import-result";

/**
 * GET ?guidelineId=… — check if linked Figma file has a newer version
 * POST { guidelineId, force? } — re-import from linked file (P6 sync)
 */
export async function GET(req: NextRequest) {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guidelineId = req.nextUrl.searchParams.get("guidelineId");
  if (!guidelineId) {
    return NextResponse.json({ error: "guidelineId required" }, { status: 400 });
  }

  const auth = await getValidFigmaAccessToken(gate.user.id);
  if (!auth) {
    return NextResponse.json({ error: "Connect Figma first" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: guideline } = await (supabase as any)
    .from("ci_guidelines")
    .select(
      "id, figma_file_key, figma_file_name, figma_file_version, figma_last_imported_at"
    )
    .eq("id", guidelineId)
    .maybeSingle();

  if (!guideline?.figma_file_key) {
    return NextResponse.json({
      linked: false,
      message: "No Figma file linked to this guideline yet.",
    });
  }

  try {
    const diff = await checkFigmaSyncStatus({
      accessToken: auth.token,
      fileKey: guideline.figma_file_key,
      previousVersion: guideline.figma_file_version,
    });
    return NextResponse.json({
      linked: true,
      fileKey: guideline.figma_file_key,
      fileName: guideline.figma_file_name || diff.fileName,
      lastImportedAt: guideline.figma_last_imported_at,
      previousVersion: diff.previousVersion,
      currentVersion: diff.currentVersion,
      changed: diff.changed,
    });
  } catch (err: any) {
    const status = err instanceof FigmaApiError ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Sync check failed" },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await getValidFigmaAccessToken(gate.user.id);
  if (!auth) {
    return NextResponse.json({ error: "Connect Figma first" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const guidelineId = String(body.guidelineId || "").trim();
  const force = Boolean(body.force);

  if (!guidelineId) {
    return NextResponse.json({ error: "guidelineId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: guideline } = await (supabase as any)
    .from("ci_guidelines")
    .select("*")
    .eq("id", guidelineId)
    .maybeSingle();

  if (!guideline?.figma_file_key) {
    return NextResponse.json(
      { error: "No Figma file linked — run an initial import first" },
      { status: 400 }
    );
  }

  try {
    const diff = await checkFigmaSyncStatus({
      accessToken: auth.token,
      fileKey: guideline.figma_file_key,
      previousVersion: guideline.figma_file_version,
    });

    if (!diff.changed && !force) {
      return NextResponse.json({
        ok: true,
        synced: false,
        skipped: true,
        message: "Figma file version unchanged. Pass force=true to re-import anyway.",
        ...diff,
      });
    }

    const { data: existingSecs } = await (supabase as any)
      .from("ci_sections")
      .select("*")
      .eq("guideline_id", guidelineId)
      .order("position", { ascending: true });

    const admin = createAdminClient();
    const pipeline = await runFigmaImportPipeline({
      accessToken: auth.token,
      fileKey: guideline.figma_file_key,
      guidelineId,
      existingSections: existingSecs || [],
      supabase: admin,
      runAiSuggest: true,
    });

    const applied = await applyImportResult(supabase, pipeline.parsed, {
      guidelineId,
      existingTheme: guideline.theme,
      mode: "additive",
      source: "figma",
      rawPayload: {
        sync: true,
        previousVersion: guideline.figma_file_version,
        currentVersion: pipeline.summary.version,
        stats: pipeline.stats,
      },
      createdBy: gate.user.id,
    });

    await (supabase as any)
      .from("ci_guidelines")
      .update({
        figma_file_name: pipeline.summary.fileName,
        figma_file_version: pipeline.summary.version,
        figma_last_imported_at: new Date().toISOString(),
        theme: applied.theme,
      })
      .eq("id", guidelineId);

    const [{ data: secs }, { data: asts }] = await Promise.all([
      (supabase as any)
        .from("ci_sections")
        .select("*")
        .eq("guideline_id", guidelineId)
        .order("position", { ascending: true }),
      (supabase as any)
        .from("ci_assets")
        .select("*")
        .eq("guideline_id", guidelineId)
        .order("sort_order", { ascending: true }),
    ]);

    return NextResponse.json({
      ok: true,
      synced: true,
      skipped: false,
      diff,
      stats: pipeline.stats,
      report: pipeline.parsed.report,
      sections: secs || applied.sections,
      assets: asts || applied.assets,
      theme: applied.theme,
    });
  } catch (err: any) {
    console.error("Figma sync error:", err);
    const status = err instanceof FigmaApiError ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Sync failed" },
      { status }
    );
  }
}
