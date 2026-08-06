import { NextRequest, NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getValidFigmaAccessToken } from "@/lib/ci-builder/figma/connection";
import { parseFigmaFileKey, FigmaApiError } from "@/lib/ci-builder/figma/client";
import { runFigmaImportPipeline } from "@/lib/ci-builder/figma/pipeline";
import { applyImportResult } from "@/lib/ci-builder/import/apply-import-result";

/**
 * POST { guidelineId, fileKey|fileUrl, teamId?, projectId?, previewOnly?, skipAi?, mode? }
 * Full P2–P5 Figma → Brand Guideline import.
 */
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
  const fileKey =
    parseFigmaFileKey(String(body.fileKey || body.fileUrl || "")) || "";
  const previewOnly = Boolean(body.previewOnly);
  const skipAi = Boolean(body.skipAi);
  const teamId = body.teamId ? String(body.teamId) : null;
  const projectId = body.projectId ? String(body.projectId) : null;
  const mode = body.mode === "replace" ? "replace" : "additive";

  if (!guidelineId || !fileKey) {
    return NextResponse.json(
      { error: "guidelineId and fileKey (or fileUrl) are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: guideline, error: glErr } = await (supabase as any)
    .from("ci_guidelines")
    .select("id, theme, project_id, figma_file_version")
    .eq("id", guidelineId)
    .maybeSingle();

  if (glErr || !guideline) {
    return NextResponse.json({ error: "Guideline not found" }, { status: 404 });
  }

  try {
    const { data: existingSecs } = await (supabase as any)
      .from("ci_sections")
      .select("*")
      .eq("guideline_id", guidelineId)
      .order("position", { ascending: true });

    // Storage uploads need service role for reliable bucket writes
    const admin = createAdminClient();

    const pipeline = await runFigmaImportPipeline({
      accessToken: auth.token,
      fileKey,
      guidelineId,
      existingSections: previewOnly ? [] : existingSecs || [],
      supabase: admin,
      previewOnly,
      skipAssetUpload: previewOnly,
      runAiSuggest: !previewOnly && !skipAi,
    });

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        preview: true,
        summary: pipeline.summary,
        variablesAvailable: pipeline.variablesAvailable,
        report: {
          totalItems: pipeline.summary.items.length,
          mapped: pipeline.summary.items.filter((i) => i.confidence === "mapped")
            .length,
          suggested: pipeline.summary.items.filter(
            (i) => i.confidence === "suggested"
          ).length,
          unmapped: pipeline.summary.items.filter(
            (i) => i.confidence === "unmapped"
          ).length,
          styles: pipeline.summary.styleCount,
          message: pipeline.parsed.report.message,
        },
      });
    }

    const applied = await applyImportResult(supabase, pipeline.parsed, {
      guidelineId,
      existingTheme: guideline.theme,
      mode,
      source: "figma",
      rawPayload: {
        fileKey,
        fileName: pipeline.summary.fileName,
        version: pipeline.summary.version,
        stats: pipeline.stats,
        variablesAvailable: pipeline.variablesAvailable,
        items: pipeline.summary.items.slice(0, 200),
      },
      createdBy: gate.user.id,
    });

    await (supabase as any)
      .from("ci_guidelines")
      .update({
        figma_file_key: fileKey,
        figma_file_name: pipeline.summary.fileName,
        figma_file_version: pipeline.summary.version,
        figma_team_id: teamId,
        figma_project_id: projectId,
        figma_last_imported_at: new Date().toISOString(),
        theme: applied.theme,
      })
      .eq("id", guidelineId);

    // Reload fresh sections/assets for client
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
      preview: false,
      summary: pipeline.summary,
      stats: pipeline.stats,
      variablesAvailable: pipeline.variablesAvailable,
      report: pipeline.parsed.report,
      sections: secs || applied.sections,
      assets: asts || applied.assets,
      theme: applied.theme,
      importId: applied.importId,
      figma: {
        fileKey,
        fileName: pipeline.summary.fileName,
        version: pipeline.summary.version,
      },
    });
  } catch (err: any) {
    console.error("Figma import error:", err);
    const status = err instanceof FigmaApiError ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Figma import failed" },
      { status }
    );
  }
}
