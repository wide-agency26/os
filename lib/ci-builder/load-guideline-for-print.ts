import { createAdminClient } from "@/utils/supabase/admin";
import type { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";

export type GuidelinePrintPayload = {
  brandName: string;
  theme: CITheme;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  slug: string | null;
  projectId: string;
};

export async function loadGuidelinePrintBySlug(
  slug: string
): Promise<GuidelinePrintPayload | null> {
  const { loadPublishedGuidelineBySlug } = await import(
    "@/lib/ci-builder/load-published-guideline"
  );
  const result = await loadPublishedGuidelineBySlug(slug);
  if (result.state !== "success") return null;
  const admin = createAdminClient();
  const { data: gl } = await admin
    .from("ci_guidelines")
    .select("project_id, slug")
    .eq("slug", slug)
    .maybeSingle();
  return {
    brandName: result.brandName,
    theme: result.theme as CITheme,
    sections: result.sections as Partial<CISection>[],
    assets: result.assets as Partial<CIAsset>[],
    slug: gl?.slug ?? slug,
    projectId: gl?.project_id ?? "",
  };
}

export async function loadGuidelinePrintByProject(
  projectId: string
): Promise<GuidelinePrintPayload | null> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  const { data: gl } = await admin
    .from("ci_guidelines")
    .select("id, slug, theme")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!gl) return null;

  const [{ data: sections }, { data: assets }] = await Promise.all([
    admin.from("ci_sections").select("*").eq("guideline_id", gl.id).order("position"),
    admin.from("ci_assets").select("*").eq("guideline_id", gl.id),
  ]);

  return {
    brandName: ((gl.theme as CITheme | null)?.coverTitle || project?.title || "Brand System") as string,
    theme: (gl.theme || {}) as CITheme,
    sections: (sections ?? []) as Partial<CISection>[],
    assets: (assets ?? []) as Partial<CIAsset>[],
    slug: gl.slug ?? null,
    projectId,
  };
}

export async function loadLiveGuidelineById(
  guidelineId: string
): Promise<(GuidelinePrintPayload & { guidelineId: string; status: string }) | null> {
  const admin = createAdminClient();
  const { data: gl } = await admin
    .from("ci_guidelines")
    .select("id, slug, theme, status, project_id, projects(title)")
    .eq("id", guidelineId)
    .maybeSingle();
  if (!gl) return null;

  const project = Array.isArray(gl.projects) ? gl.projects[0] : gl.projects;
  const [{ data: sections }, { data: assets }] = await Promise.all([
    admin.from("ci_sections").select("*").eq("guideline_id", gl.id).order("position"),
    admin.from("ci_assets").select("*").eq("guideline_id", gl.id),
  ]);

  return {
    guidelineId: gl.id,
    brandName:
      (gl.theme as CITheme | null)?.coverTitle ||
      (project as { title?: string } | null)?.title ||
      "Brand System",
    theme: (gl.theme || {}) as CITheme,
    sections: (sections ?? []) as Partial<CISection>[],
    assets: (assets ?? []) as Partial<CIAsset>[],
    slug: gl.slug ?? null,
    projectId: gl.project_id,
    status: gl.status || "draft",
  };
}
