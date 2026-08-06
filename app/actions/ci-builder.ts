"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

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
