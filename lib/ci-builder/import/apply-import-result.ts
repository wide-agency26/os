/**
 * Shared persist path for JSON + Figma imports.
 * Produces the same UUID remapping + upsert behavior previously inline in AdminEditor.
 */

import type { CIAsset, CISection, CITheme } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import type { ParseResult } from "@/lib/ci-builder/parser";

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export type ApplyImportOptions = {
  guidelineId: string;
  existingTheme?: CITheme | Record<string, unknown> | null;
  /** Additive (default): upsert sections/assets. Replace: wipe then insert. */
  mode?: "additive" | "replace";
  source?: "json" | "figma";
  /** Optional raw payload for ci_imports audit */
  rawPayload?: unknown;
  createdBy?: string | null;
};

export type ApplyImportResult = {
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  theme: CITheme;
  importId: string | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

export async function applyImportResult(
  supabase: SupabaseLike,
  parsed: ParseResult,
  options: ApplyImportOptions
): Promise<ApplyImportResult> {
  const {
    guidelineId,
    existingTheme = {},
    mode = "additive",
    source = "json",
    rawPayload,
    createdBy,
  } = options;

  if (mode === "replace") {
    await supabase.from("ci_assets").delete().eq("guideline_id", guidelineId);
    await supabase.from("ci_sections").delete().eq("guideline_id", guidelineId);
  }

  const sectionIdMap = new Map<string, string>();
  const newSections = parsed.sections.map((s, i) => {
    const oldId = s.id || "";
    const validId = isValidUUID(oldId) ? oldId : generateUUID();
    if (oldId && oldId !== validId) sectionIdMap.set(oldId, validId);
    return {
      ...s,
      id: validId,
      guideline_id: guidelineId,
      position: s.position !== undefined ? s.position : i,
    };
  });

  const assetIdMap = new Map<string, string>();
  const newAssets = parsed.assets.map((a) => {
    const oldId = a.id || "";
    const validId = isValidUUID(oldId) ? oldId : generateUUID();
    if (oldId && oldId !== validId) assetIdMap.set(oldId, validId);

    let secId = a.section_id ?? null;
    if (secId && sectionIdMap.has(secId)) {
      secId = sectionIdMap.get(secId)!;
    } else if (secId && !isValidUUID(secId)) {
      secId = null;
    }

    return {
      ...a,
      id: validId,
      guideline_id: guidelineId,
      section_id: secId,
      storage_path: a.storage_path || `pending/${validId}`,
      public_url: a.public_url || "",
      metadata: {
        ...(a.metadata || {}),
        import_source: source,
      },
    };
  });

  newSections.forEach((sec) => {
    let dStr = JSON.stringify(sec.data || {});
    assetIdMap.forEach((validId, oldId) => {
      if (oldId && validId && dStr.includes(oldId)) {
        dStr = dStr.replaceAll(oldId, validId);
      }
    });
    sec.data = JSON.parse(dStr);
  });

  if (newSections.length > 0) {
    const { error: secErr } = await supabase.from("ci_sections").upsert(newSections);
    if (secErr) throw secErr;
  }

  if (newAssets.length > 0) {
    const { error: astErr } = await supabase.from("ci_assets").upsert(newAssets);
    if (astErr) throw astErr;
  }

  const mergedTheme = {
    ...(existingTheme || {}),
    ...(parsed.themeSuggested || {}),
  } as CITheme;

  if (parsed.themeSuggested && Object.keys(parsed.themeSuggested).length > 0) {
    const { error: themeErr } = await supabase
      .from("ci_guidelines")
      .update({ theme: mergedTheme })
      .eq("id", guidelineId);
    if (themeErr) throw themeErr;
  }

  let importId: string | null = null;
  try {
    const { data: importRow, error: importErr } = await supabase
      .from("ci_imports")
      .insert({
        guideline_id: guidelineId,
        source,
        raw_payload: rawPayload ?? null,
        parse_report: parsed.report,
        created_by: createdBy ?? null,
      })
      .select("id")
      .maybeSingle();
    if (!importErr && importRow?.id) importId = importRow.id;
  } catch {
    // Audit table may be unavailable — import itself still succeeds
  }

  return {
    sections: newSections,
    assets: newAssets,
    theme: mergedTheme,
    importId,
  };
}
