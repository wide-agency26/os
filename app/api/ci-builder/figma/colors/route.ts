import { NextRequest, NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection } from "@/lib/ci-builder/types";
import {
  COLOR_SECTION_TYPES,
  normalizeColorsFromDump,
  parseColorVariablesDump,
} from "@/lib/ci-builder/figma/normalize/colors";
import { ensureReadableTheme } from "@/lib/ci-builder/theme-css";

function isColorSectionType(type: string | undefined): boolean {
  return Boolean(
    type && (COLOR_SECTION_TYPES as readonly string[]).includes(type)
  );
}

/**
 * POST { guidelineId, variablesDump }
 * Apply a WIDE OS plugin Brand Colors dump onto color sections only.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const guidelineId = String(body.guidelineId || "").trim();
  const dump = parseColorVariablesDump(body.variablesDump ?? body.dump ?? body);
  if (!guidelineId) {
    return NextResponse.json({ error: "guidelineId is required" }, { status: 400 });
  }
  if (!dump) {
    return NextResponse.json(
      {
        error:
          "Invalid Brand Colors JSON. In Figma run WIDE OS · Copy brand colors, then paste the result.",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: guideline, error: glErr } = await (supabase as any)
    .from("ci_guidelines")
    .select("id, theme")
    .eq("id", guidelineId)
    .maybeSingle();

  if (glErr || !guideline) {
    return NextResponse.json({ error: "Guideline not found" }, { status: 404 });
  }

  const { data: existingSecs } = await (supabase as any)
    .from("ci_sections")
    .select("*")
    .eq("guideline_id", guidelineId)
    .order("position", { ascending: true });

  const sections: Partial<CISection>[] = (existingSecs || []).map(
    (s: Partial<CISection>) => ({
      ...s,
      data: s.data ? { ...s.data } : s.data,
    })
  );

  const themeSuggested: Record<string, any> = {
    ...(guideline.theme || {}),
    accentColors: Array.isArray(guideline.theme?.accentColors)
      ? [...guideline.theme.accentColors]
      : [],
  };

  const stats = normalizeColorsFromDump({
    dump,
    sections,
    themeSuggested,
  });

  const colorSecs = sections
    .filter((s) => isColorSectionType(s.section_type))
    .map((s, i) => ({
      ...s,
      id: s.id || generateUUID(),
      guideline_id: guidelineId,
      position: s.position !== undefined ? s.position : i,
    }));

  if (colorSecs.length > 0) {
    const { error: secErr } = await (supabase as any)
      .from("ci_sections")
      .upsert(colorSecs);
    if (secErr) {
      return NextResponse.json({ error: secErr.message }, { status: 500 });
    }
  }

  const mergedTheme = ensureReadableTheme({
    ...(guideline.theme || {}),
    ...themeSuggested,
  });

  if (Object.keys(themeSuggested).length > 0) {
    await (supabase as any)
      .from("ci_guidelines")
      .update({ theme: mergedTheme })
      .eq("id", guidelineId);
  }

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
    stats,
    theme: mergedTheme,
    sections: secs || colorSecs,
    assets: asts || [],
    report: {
      message: `Brand Colors: ${stats.fromDump} swatches from plugin dump.`,
    },
  });
}
