import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ToolProjectPicker } from "@/components/tools/ToolProjectPicker";
import { CONTENT_TOOL_SERVICES, loadToolProjects } from "@/lib/projects/tool-scope";

export const dynamic = "force-dynamic";

export default async function ContentToolsHub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !isFounder(profile.role)) redirect("/app/home");

  const { featured, all } = await loadToolProjects(supabase, CONTENT_TOOL_SERVICES, "content");

  return (
    <Workspace>
      <ToolProjectPicker
        eyebrow="Content"
        title="Content calendar"
        subtitle="Only live projects that include Social Media Content."
        featuredLabel="Live social"
        featured={featured}
        all={all}
        hrefTemplate="/app/projects/{id}/content"
        emptyFeatured="No live project currently includes Social Media Content. Use All projects if you need a one-off."
        tool="content"
      />
    </Workspace>
  );
}
