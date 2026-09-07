import { Workspace } from "@/components/frappe-ui/Workspace";
import { BlogBuilderApp } from "@/components/blog/BlogBuilderApp";
import { createClient } from "@/utils/supabase/server";
import { loadBlogWorkspace } from "@/lib/blog/load";
import { redirect } from "next/navigation";
import { isFounder } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProjectBlogPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isFounder(profile?.role)) redirect("/app/client-blog");

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client_id, crm_customers:client_id ( company, name )")
    .eq("id", project_id)
    .maybeSingle();
  if (!project) redirect("/app/work");

  const co = Array.isArray(project.crm_customers)
    ? project.crm_customers[0]
    : project.crm_customers;
  const clientLabel = co?.company || co?.name || undefined;

  const bundle = await loadBlogWorkspace(supabase as any, project_id);

  return (
    <Workspace wide>
      <BlogBuilderApp
        projectId={project_id}
        title={project.title || "Project"}
        clientLabel={clientLabel}
        settings={bundle.settings}
        opportunities={bundle.opportunities}
        articles={bundle.articles}
        corpus={bundle.corpus}
        runs={bundle.runs}
        activeJob={bundle.activeJob}
      />
    </Workspace>
  );
}
