import { Workspace } from "@/components/frappe-ui/Workspace";
import { BlogEditor } from "@/components/blog/BlogEditor";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { createClient } from "@/utils/supabase/server";
import { loadArticle } from "@/lib/blog/load";
import { workPaths } from "@/lib/work/paths";
import { redirect } from "next/navigation";
import { isFounder } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProjectBlogArticlePage({
  params,
}: {
  params: Promise<{ project_id: string; article_id: string }>;
}) {
  const { project_id, article_id } = await params;
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

  const [{ data: project }, article] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, crm_customers:client_id ( company, name )")
      .eq("id", project_id)
      .maybeSingle(),
    loadArticle(supabase as any, article_id),
  ]);

  if (!project) redirect("/app/work");
  if (!article || article.project_id !== project_id) {
    redirect(workPaths.projectBlog(project_id));
  }

  const co = Array.isArray(project.crm_customers)
    ? project.crm_customers[0]
    : project.crm_customers;
  const clientLabel = co?.company || co?.name || undefined;

  return (
    <Workspace wide>
      <ProjectPmShell
        projectId={project_id}
        title={project.title || "Project"}
        clientLabel={clientLabel}
      >
        <BlogEditor article={article} />
      </ProjectPmShell>
    </Workspace>
  );
}
