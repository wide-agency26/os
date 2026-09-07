import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { requireEnabledClientNav } from "@/app/actions/client-nav";
import { monthStart } from "@/lib/content/types";
import { loadClientScopedProjects, pickProjectId } from "@/lib/client/scope";
import { readViewAsCompanyId, readViewAsContactId } from "@/lib/client/view-as.server";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import {
  ClientEmptyState,
  ClientPortalFrame,
  ClientProjectSwitcher,
} from "@/components/client/ClientPortalFrame";
import { ClientBlogCalendar } from "@/components/client/ClientBlogCalendar";

export const dynamic = "force-dynamic";

export default async function ClientBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireEnabledClientNav("blog");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const staff = isFounder(profile?.role);
  const { projects } = await loadClientScopedProjects(supabase as any, {
    userId: user.id,
    staff,
    viewAsCompanyId: staff ? await readViewAsCompanyId() : null,
    viewAsContactId: staff ? await readViewAsContactId() : null,
  });

  if (!projects.length) {
    return (
      <ClientAccessFlowGate>
        <ClientPortalFrame eyebrow="Editorial" title="Blog calendar">
          <ClientEmptyState
            title="No project on your account yet"
            message="Your account manager will share the blog calendar here once a project is linked."
          />
        </ClientPortalFrame>
      </ClientAccessFlowGate>
    );
  }

  const projectId = pickProjectId(projects, sp.project);
  const project = projects.find((p) => p.id === projectId)!;
  const periodStart =
    sp.month && /^\d{4}-\d{2}/.test(sp.month)
      ? `${sp.month.slice(0, 7)}-01`
      : monthStart(new Date());

  const { data: rows } = await (supabase as any)
    .from("blog_articles")
    .select(
      "id, title, slug, language, meta_description, scheduled_for, published_at, published_url, status, client_visible"
    )
    .eq("project_id", projectId)
    .eq("client_visible", true)
    .or("scheduled_for.not.is.null,published_at.not.is.null,status.in.(scheduled,published)")
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  const monthPrefix = periodStart.slice(0, 7);
  const articles = ((rows ?? []) as {
    id: string;
    title: string;
    slug: string | null;
    language: string;
    meta_description: string | null;
    scheduled_for: string | null;
    published_at: string | null;
    published_url: string | null;
    status: string;
  }[]).filter((a) => {
    const d = a.scheduled_for || a.published_at?.slice(0, 10);
    return d ? d.startsWith(monthPrefix) : false;
  });

  return (
    <ClientAccessFlowGate>
      <ClientPortalFrame
        eyebrow="Editorial"
        title="Blog calendar"
        subtitle={`${project.title} — articles for your site.`}
        actions={
          <ClientProjectSwitcher projects={projects} projectId={projectId} />
        }
      >
        <ClientBlogCalendar
          projectId={projectId}
          periodStart={periodStart}
          articles={articles}
        />
      </ClientPortalFrame>
    </ClientAccessFlowGate>
  );
}
