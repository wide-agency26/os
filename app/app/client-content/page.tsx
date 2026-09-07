import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { requireEnabledClientNav } from "@/app/actions/client-nav";
import { loadClientVisibleMonth } from "@/lib/content/load";
import { loadProjectBrandAvatar } from "@/lib/content/project-brand-avatar";
import {
  loadClientScopedProjects,
  pickProjectIdWithSharedContent,
} from "@/lib/client/scope";
import { ClientContentView } from "@/components/content/ClientContentView";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import { readViewAsCompanyId, readViewAsContactId } from "@/lib/client/view-as.server";
import {
  ClientEmptyState,
  ClientPortalFrame,
  ClientProjectSwitcher,
} from "@/components/client/ClientPortalFrame";

export const dynamic = "force-dynamic";

/** Client-facing calendar. Shared months only (in_review / approved). */

function Empty({
  message,
  projects,
  projectId,
}: {
  message: string;
  projects?: { id: string; title: string }[];
  projectId?: string;
}) {
  return (
    <ClientAccessFlowGate>
      <ClientPortalFrame
        eyebrow="Content"
        title="Content calendar"
        actions={
          projects?.length && projectId ? (
            <ClientProjectSwitcher projects={projects} projectId={projectId} />
          ) : undefined
        }
      >
        <ClientEmptyState title="No content calendar yet" message={message} />
      </ClientPortalFrame>
    </ClientAccessFlowGate>
  );
}

export default async function ClientContentPage({
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
  await requireEnabledClientNav("content");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const founder = isFounder(profile?.role);
  const { companyIds, projects: list } = await loadClientScopedProjects(supabase as any, {
    userId: user.id,
    staff: founder,
    viewAsCompanyId: founder ? await readViewAsCompanyId() : null,
    viewAsContactId: founder ? await readViewAsContactId() : null,
  });

  if (!founder && !companyIds.length) {
    return (
      <Empty message="Your account is not linked to a company yet. Please contact your account manager." />
    );
  }
  if (!list.length) {
    return (
      <Empty message="There is no project on your account yet. Your account manager will share a calendar here when it is ready." />
    );
  }

  const projectOptions = list.map((p) => ({ id: p.id, title: p.title }));
  const projectId = await pickProjectIdWithSharedContent(supabase as any, list, sp.project);
  const project = list.find((p) => p.id === projectId)!;
  const bundle = await loadClientVisibleMonth(
    supabase as any,
    projectId,
    sp.month || ""
  );
  const brandAvatar = await loadProjectBrandAvatar(supabase as any, projectId);

  if (!bundle.periodStart) {
    return (
      <Empty
        projects={projectOptions}
        projectId={projectId}
        message={
          founder
            ? `Nothing shared for “${project.title}” yet. Set the month to In review or Approved (or Share with client) on the project content calendar.`
            : "Your account manager has not shared a content calendar for review yet."
        }
      />
    );
  }

  return (
    <ClientAccessFlowGate>
      <ClientContentView
        projectId={projectId}
        projectTitle={project.title}
        brandAvatarUrl={brandAvatar.avatarUrl}
        periodStart={bundle.periodStart}
        settings={bundle.settings}
        posts={bundle.posts}
        comments={bundle.comments}
        months={bundle.months}
        projects={projectOptions}
      />
    </ClientAccessFlowGate>
  );
}
