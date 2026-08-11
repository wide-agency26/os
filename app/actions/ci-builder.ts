"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  migrateLegacySections,
  needsLegacyMigration,
} from "@/lib/ci-builder/migrate-legacy-sections";
import type { CIAsset, CISection } from "@/lib/ci-builder/types";
import type { Json } from "@/types/supabase";

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
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (glErr) return { ok: false, error: glErr.message };
  if (!guideline) return { ok: false, error: "No guideline found for this project" };

  const guidelineId = guideline.id;

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

  const secs = (sections || []) as Partial<CISection>[];
  const asts = (assets || []) as Partial<CIAsset>[];

  if (!needsLegacyMigration(secs)) {
    return { ok: true, migrated: false, sections: secs, assets: asts };
  }

  const result = migrateLegacySections(guidelineId, secs, asts);

  if (result.deletedSectionIds.length > 0) {
    const { error: delErr } = await supabase
      .from("ci_sections")
      .delete()
      .in("id", result.deletedSectionIds);
    if (delErr) return { ok: false, error: `Failed to remove legacy sections: ${delErr.message}` };
  }

  if (result.sections.length > 0) {
    const rows = result.sections
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
    const nextSectionId = result.assetSectionMap[a.id];
    if (!nextSectionId) {
      // Unbind assets that pointed at deleted legacy sections
      if (a.section_id && result.deletedSectionIds.includes(a.section_id)) {
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

  await supabase
    .from("ci_guidelines")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", guidelineId);

  revalidatePath("/app/projects/ci-builder");
  revalidatePath(`/app/projects/${projectId}/ci-builder`);
  revalidatePath("/app/client-guidelines");

  return {
    ok: true,
    migrated: true,
    sections: result.sections,
    assets: updatedAssets,
  };
}

/**
 * Wipe all CI builder content for a project guideline so admins can start fresh.
 * Deletes sections, assets, and published versions; resets guideline to an empty draft.
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
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (glErr) return { ok: false, error: glErr.message };
  if (!guideline) return { ok: false, error: "No guideline found for this project" };

  const guidelineId = guideline.id;

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
      theme: {},
      status: "draft",
      slug: null,
      published_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guidelineId);

  if (resetErr) return { ok: false, error: `Failed to reset guideline: ${resetErr.message}` };

  revalidatePath("/app/projects/ci-builder");
  revalidatePath("/app/client-guidelines");
  return { ok: true };
}
