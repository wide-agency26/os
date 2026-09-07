import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ToolProjectPicker } from "@/components/tools/ToolProjectPicker";
import { BLOG_TOOL_SERVICES, loadToolProjects } from "@/lib/projects/tool-scope";

export const dynamic = "force-dynamic";

export default async function BlogBuilderHub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !isFounder(profile.role)) redirect("/app/home");

  const { featured, all } = await loadToolProjects(supabase, BLOG_TOOL_SERVICES, "blog");

  return (
    <Workspace>
      <ToolProjectPicker
        eyebrow="Editorial"
        title="Blog Builder"
        subtitle="Only live projects that include SEO. Open one to run the overnight pipeline."
        featuredLabel="Live SEO"
        featured={featured}
        all={all}
        hrefTemplate="/app/projects/{id}/blog"
        emptyFeatured="No live project currently includes SEO. Use All projects if you need a one-off."
        tool="blog"
      />
    </Workspace>
  );
}
