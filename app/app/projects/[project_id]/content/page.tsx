import { Workspace } from "@/components/frappe-ui/Workspace";
import { ContentCalendarApp } from "@/components/content/ContentCalendarApp";
import { createClient } from "@/utils/supabase/server";
import { assembleProjectContext } from "@/lib/content/assemble";
import { loadCalendarBundle } from "@/lib/content/load";
import { loadProjectBrandAvatar } from "@/lib/content/project-brand-avatar";
import { monthStart } from "@/lib/content/types";
import { redirect } from "next/navigation";
import { isFounder } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProjectContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ project_id: string }>;
  searchParams: Promise<{ month?: string; tab?: string }>;
}) {
  const { project_id } = await params;
  const sp = await searchParams;
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
  if (!isFounder(profile?.role)) redirect("/app/client-content");

  const periodStart = sp.month && /^\d{4}-\d{2}-01$/.test(sp.month)
    ? sp.month
    : monthStart(new Date());

  const initialPanel =
    sp.tab === "settings" || sp.tab === "context" ? sp.tab : "calendar";

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

  const [bundle, context, brandAvatar] = await Promise.all([
    loadCalendarBundle(supabase, project_id, periodStart),
    assembleProjectContext(supabase, project_id),
    loadProjectBrandAvatar(supabase, project_id),
  ]);

  return (
    <Workspace wide>
      <ContentCalendarApp
        projectId={project_id}
        title={project.title || "Project"}
        clientLabel={clientLabel}
        brandAvatarUrl={brandAvatar.avatarUrl}
        periodStart={periodStart}
        settings={bundle.settings}
        calendar={bundle.calendar}
        posts={bundle.posts}
        missedPosts={bundle.missedPosts}
        docs={bundle.docs}
        comments={bundle.comments}
        unread={bundle.unread}
        context={context}
        initialPanel={initialPanel}
      />
    </Workspace>
  );
}
