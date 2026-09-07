"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  migrateLegacySections,
  needsLegacyMigration,
  needsLogoMarksMigration,
  migrateLogoSlotsToMarks,
} from "@/lib/ci-builder/migrate-legacy-sections";
import type { CIAsset, CISection, CITheme } from "@/lib/ci-builder/types";
import { CI_SCHEMA_VERSION } from "@/lib/ci-builder/types";
import type { Json } from "@/types/supabase";
import {
  generateTextFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import {
  defaultClientDescription,
  isImportBoilerplate,
} from "@/lib/ci-builder/section-copy";

/**
 * Split legacy combined sections into the 9×52 submodule catalog.
 * Rebinds assets; does not delete asset files.
 */
export async function migrateCiGuidelineToSubmodules(projectId: string): Promise<{
  ok: boolean;
  migrated?: boolean;
  sections?: Partial<CISection>[];
  assets?: Partial<CIAsset>[];
  error?: string;
}> {
  if (!projectId) return { ok: false, error: "Missing project id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isFounder(profile.role)) {
    return { ok: false, error: "Only admins can migrate brand guidelines" };
  }

  const { data: guideline, error: glErr } = await supabase
    .from("ci_guidelines")
    .select("id, theme")
    .eq("project_id", projectId)
    .maybeSingle();

  if (glErr) return { ok: false, error: glErr.message };
  if (!guideline) return { ok: false, error: "No guideline found for this project" };

  const guidelineId = guideline.id;
  const theme = (guideline.theme || {}) as CITheme;

  const { data: sections, error: secErr } = await supabase
    .from("ci_sections")
    .select("*")
    .eq("guideline_id", guidelineId)
    .order("position", { ascending: true });
  if (secErr) return { ok: false, error: secErr.message };

  const { data: assets, error: astErr } = await supabase
    .from("ci_assets")
    .select("*")
    .eq("guideline_id", guidelineId);
  if (astErr) return { ok: false, error: astErr.message };

  let secs = (sections || []) as Partial<CISection>[];
  let asts = (assets || []) as Partial<CIAsset>[];
  let didMigrate = false;
  const assetSectionMap: Record<string, string> = {};
  const deletedSectionIds: string[] = [];

  if (needsLegacyMigration(secs)) {
    const result = migrateLegacySections(guidelineId, secs, asts);
    secs = result.sections;
    Object.assign(assetSectionMap, result.assetSectionMap);
    deletedSectionIds.push(...result.deletedSectionIds);
    didMigrate = true;
  }

  if (needsLogoMarksMigration(secs)) {
    const logoResult = migrateLogoSlotsToMarks(secs, guidelineId);
    secs = logoResult.sections;
    Object.assign(assetSectionMap, logoResult.assetSectionMap);
    deletedSectionIds.push(...logoResult.deletedSectionIds);
    didMigrate = true;
  }

  if (!didMigrate && (theme.schemaVersion ?? 0) >= CI_SCHEMA_VERSION) {
    return { ok: true, migrated: false, sections: secs, assets: asts };
  }

  if (deletedSectionIds.length > 0) {
    const { error: delErr } = await supabase
      .from("ci_sections")
      .delete()
      .in("id", deletedSectionIds);
    if (delErr) return { ok: false, error: `Failed to remove legacy sections: ${delErr.message}` };
  }

  if (secs.length > 0 && didMigrate) {
    const rows = secs
      .filter((s): s is typeof s & { section_type: string } => Boolean(s.section_type))
      .map((s, i) => ({
        id: s.id,
        guideline_id: guidelineId,
        section_type: s.section_type,
        position: i,
        eyebrow_label: s.eyebrow_label ?? null,
        headline: s.headline ?? null,
        headline_emphasis: s.headline_emphasis ?? null,
        description: s.description ?? null,
        is_visible: s.is_visible !== false,
        data: (s.data ?? {}) as unknown as Json,
      }));
    const { error: insErr } = await supabase.from("ci_sections").upsert(rows);
    if (insErr) return { ok: false, error: `Failed to insert submodules: ${insErr.message}` };
  }

  const updatedAssets = asts.map((a) => {
    if (!a.id) return a;
    const nextSectionId = assetSectionMap[a.id];
    if (!nextSectionId) {
      if (a.section_id && deletedSectionIds.includes(a.section_id)) {
        return { ...a, section_id: null };
      }
      return a;
    }
    return { ...a, section_id: nextSectionId };
  });

  for (const a of updatedAssets) {
    if (!a.id) continue;
    const prev = asts.find((x) => x.id === a.id);
    if (prev?.section_id === a.section_id) continue;
    const { error: upErr } = await supabase
      .from("ci_assets")
      .update({ section_id: a.section_id ?? null })
      .eq("id", a.id);
    if (upErr) return { ok: false, error: `Failed to rebind assets: ${upErr.message}` };
  }

  const nextTheme: CITheme = {
    ...theme,
    schemaVersion: CI_SCHEMA_VERSION,
    clientTemplate: theme.clientTemplate || "greenpoint",
  };

  await supabase
    .from("ci_guidelines")
    .update({
      theme: nextTheme as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guidelineId);

  revalidatePath("/app/tools/ci");
  revalidatePath(`/app/projects/${projectId}/ci-builder`);
  revalidatePath("/app/client-guidelines");

  return {
    ok: true,
    migrated: true,
    sections: secs,
    assets: updatedAssets,
  };
}

/**
 * Wipe all CI builder content for a project guideline so admins can start fresh.
 * Deletes sections, assets, and published versions; resets guideline to an empty draft.
 * Keeps linked Figma file columns (`figma_file_*`) so Import / Re-sync still work.
 */
export async function resetCiGuideline(projectId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!projectId) return { ok: false, error: "Missing project id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isFounder(profile.role)) {
    return { ok: false, error: "Only admins can reset brand guidelines" };
  }

  const { data: guideline, error: glErr } = await supabase
    .from("ci_guidelines")
    .select("id, theme")
    .eq("project_id", projectId)
    .maybeSingle();

  if (glErr) return { ok: false, error: glErr.message };
  if (!guideline) return { ok: false, error: "No guideline found for this project" };

  const guidelineId = guideline.id;
  const prevTheme = (guideline.theme || {}) as { clientTemplate?: string; schemaVersion?: number };

  // Explicit deletes (also cascade from guideline delete, but clear first for clarity)
  const { error: secErr } = await supabase
    .from("ci_sections")
    .delete()
    .eq("guideline_id", guidelineId);
  if (secErr) return { ok: false, error: `Failed to delete sections: ${secErr.message}` };

  const { error: assetErr } = await supabase
    .from("ci_assets")
    .delete()
    .eq("guideline_id", guidelineId);
  if (assetErr) return { ok: false, error: `Failed to delete assets: ${assetErr.message}` };

  const { error: verErr } = await supabase
    .from("ci_guideline_versions")
    .delete()
    .eq("guideline_id", guidelineId);
  if (verErr) return { ok: false, error: `Failed to delete versions: ${verErr.message}` };

  const { error: resetErr } = await supabase
    .from("ci_guidelines")
    .update({
      theme: {
        schemaVersion: prevTheme.schemaVersion || 2,
        clientTemplate: prevTheme.clientTemplate || "greenpoint",
      },
      status: "draft",
      slug: null,
      published_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guidelineId);

  if (resetErr) return { ok: false, error: `Failed to reset guideline: ${resetErr.message}` };

  revalidatePath("/app/tools/ci");
  revalidatePath("/app/client-guidelines");
  return { ok: true };
}

/**
 * Remove one CI section (sub-module) from a project's guideline.
 * Bound assets are unbound into the Unassigned pool rather than deleted.
 */
export async function deleteCiSection(
  projectId: string,
  sectionId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!projectId) return { ok: false, error: "Missing project id" };
  if (!sectionId) return { ok: false, error: "Missing section id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isFounder(profile.role)) {
    return { ok: false, error: "Only admins can delete guideline sections" };
  }

  const { data: guideline, error: glErr } = await supabase
    .from("ci_guidelines")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (glErr) return { ok: false, error: glErr.message };
  if (!guideline) return { ok: false, error: "No guideline found for this project" };

  const { data: section, error: secLookupErr } = await supabase
    .from("ci_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("guideline_id", guideline.id)
    .maybeSingle();

  if (secLookupErr) return { ok: false, error: secLookupErr.message };
  if (!section) return { ok: false, error: "Section not found on this guideline" };

  // Unbind first — ci_assets.section_id cascades on section delete.
  const { error: unbindErr } = await supabase
    .from("ci_assets")
    .update({ section_id: null })
    .eq("section_id", sectionId);
  if (unbindErr) {
    return { ok: false, error: `Failed to unbind assets: ${unbindErr.message}` };
  }

  const { error: delErr } = await supabase
    .from("ci_sections")
    .delete()
    .eq("id", sectionId)
    .eq("guideline_id", guideline.id);
  if (delErr) return { ok: false, error: `Failed to delete section: ${delErr.message}` };

  await supabase
    .from("ci_guidelines")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", guideline.id);

  revalidatePath("/app/tools/ci");
  revalidatePath(`/app/projects/${projectId}/ci-builder`);
  revalidatePath("/app/client-guidelines");

  return { ok: true };
}

export async function proposeCiSectionCopy(opts: {
  sectionType: string;
  headline?: string;
  labels?: string[];
  currentDescription?: string;
}): Promise<{ ok: boolean; text?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { ok: false, error: "Only admins can propose copy" };
  }

  const fallback = defaultClientDescription(opts.sectionType);
  if (!hasGatewayCredentials()) {
    return { ok: true, text: fallback };
  }

  try {
    const text = await generateTextFromGateway({
      system: `You write one short brand-guideline caption for a client (not a designer implementation note).
1–2 sentences. Concrete. No "Imported from Figma". No Tailwind/CSS jargon. No marketing fluff.
Editorial, restrained, like a studio brand book.`,
      prompt: JSON.stringify({
        sectionType: opts.sectionType,
        headline: opts.headline || "",
        labels: (opts.labels || []).slice(0, 12),
        current: opts.currentDescription || "",
        fallback,
      }),
      maxOutputTokens: 220,
      temperature: 0.4,
    });
    const cleaned = (text || "").trim();
    if (!cleaned || isImportBoilerplate(cleaned)) {
      return { ok: true, text: fallback };
    }
    return { ok: true, text: cleaned };
  } catch {
    return { ok: true, text: fallback };
  }
}

