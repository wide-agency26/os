import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/utils/supabase/env";

export type PublishedGuidelinePayload =
  | { state: "not_found" }
  | { state: "draft"; brandName: string }
  | { state: "no_snapshot"; brandName: string }
  | {
      state: "success";
      brandName: string;
      theme: Record<string, unknown>;
      sections: unknown[];
      assets: unknown[];
    };

function createFallbackClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey());
}

export async function loadPublishedGuidelineBySlug(
  slug: string
): Promise<PublishedGuidelinePayload> {
  let supabase: ReturnType<typeof createAdminClient> | ReturnType<typeof createFallbackClient>;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = createFallbackClient();
  }

  const { data: guideline, error: glErr } = await supabase
    .from("ci_guidelines")
    .select("id, status, theme, project_id, projects(title)")
    .eq("slug", slug)
    .maybeSingle();

  if (glErr || !guideline) {
    return { state: "not_found" };
  }

  const project = Array.isArray(guideline.projects)
    ? guideline.projects[0]
    : guideline.projects;
  const brandName =
    (project as { title?: string } | null)?.title || "Brand System";

  if (guideline.status !== "published") {
    return { state: "draft", brandName };
  }

  const { data: version, error: verErr } = await supabase
    .from("ci_guideline_versions")
    .select("content")
    .eq("guideline_id", guideline.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verErr || !version?.content) {
    return { state: "no_snapshot", brandName };
  }

  const content = version.content as {
    theme?: Record<string, unknown>;
    sections?: unknown[];
    assets?: unknown[];
  };

  return {
    state: "success",
    brandName,
    theme: content.theme || (guideline.theme as Record<string, unknown>) || {},
    sections: content.sections || [],
    assets: content.assets || [],
  };
}
