import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { requireEnabledClientNav } from "@/app/actions/client-nav";
import { loadClientProgressForPortal } from "@/app/actions/project-progress";
import { loadClientScopedProjects } from "@/lib/client/scope";
import { ClientProgressView } from "@/components/client/ClientProgressView";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import { readViewAsCompanyId, readViewAsContactId } from "@/lib/client/view-as.server";
import {
  ClientEmptyState,
  ClientPortalFrame,
  ClientProjectSwitcher,
} from "@/components/client/ClientPortalFrame";
import {
  isProgressPublished,
  parseProjectProgress,
} from "@/lib/client/progress";

export const dynamic = "force-dynamic";

function pickProjectWithProgress(
  list: { id: string; title: string; client_progress?: unknown }[],
  requested?: string
): string {
  if (requested && list.some((p) => p.id === requested)) return requested;
  const published = list.find((p) =>
    isProgressPublished(parseProjectProgress(p.id, p.client_progress))
  );
  return published?.id || list[0]!.id;
}

export default async function ClientProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireEnabledClientNav("progress");

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
      <ClientAccessFlowGate>
        <ClientPortalFrame eyebrow="Progress" title="Progress">
          <ClientEmptyState
            title="No company yet"
            message="Your account is not linked to a company yet. Please contact your account manager."
          />
        </ClientPortalFrame>
      </ClientAccessFlowGate>
    );
  }

  if (!list.length) {
    return (
      <ClientAccessFlowGate>
        <ClientPortalFrame eyebrow="Progress" title="Progress">
          <ClientEmptyState
            title="No project yet"
            message="There is no project on your account yet."
          />
        </ClientPortalFrame>
      </ClientAccessFlowGate>
    );
  }

  // Load progress column for picker preference
  const adminIds = list.map((p) => p.id);
  const { data: withProgress } = await supabase
    .from("projects")
    .select("id, client_progress")
    .in("id", adminIds);
  const progressById = new Map(
    (withProgress ?? []).map((r) => [r.id as string, r.client_progress])
  );
  const enriched = list.map((p) => ({
    ...p,
    client_progress: progressById.get(p.id),
  }));

  const projectOptions = list.map((p) => ({ id: p.id, title: p.title }));
  const projectId = pickProjectWithProgress(enriched, sp.project);
  const project = list.find((p) => p.id === projectId)!;
  const { progress, empty, publisherName } = await loadClientProgressForPortal(projectId);

  return (
    <ClientAccessFlowGate>
      <ClientPortalFrame
        eyebrow="Progress"
        title="Progress"
        actions={
          projectOptions.length > 1 ? (
            <ClientProjectSwitcher projects={projectOptions} projectId={projectId} />
          ) : undefined
        }
      >
        <p className="text-[13px] text-text-secondary mb-6 -mt-2">{project.title}</p>
        <ClientProgressView
          progress={progress}
          empty={empty}
          publisherName={publisherName}
        />
      </ClientPortalFrame>
    </ClientAccessFlowGate>
  );
}
