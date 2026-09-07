import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { requireEnabledClientNav } from "@/app/actions/client-nav";
import { loadClientScopedProjects, pickProjectId } from "@/lib/client/scope";
import { readViewAsCompanyId, readViewAsContactId } from "@/lib/client/view-as.server";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import {
  ClientEmptyState,
  ClientPortalFrame,
  ClientProjectSwitcher,
} from "@/components/client/ClientPortalFrame";
import { ClientTaskKanban } from "@/components/client/ClientTaskKanban";
import type { PmTaskStatus } from "@/lib/pm/types";

export const dynamic = "force-dynamic";

export default async function ClientTasksPage({
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
  await requireEnabledClientNav("tasks");

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
        <ClientPortalFrame eyebrow="Delivery" title="Project board">
          <ClientEmptyState
            title="No project on your account yet"
            message="Your account manager will share a live board here once a project is linked to your company."
          />
        </ClientPortalFrame>
      </ClientAccessFlowGate>
    );
  }

  const projectId = pickProjectId(projects, sp.project);
  const project = projects.find((p) => p.id === projectId)!;

  const { data: rows } = await (supabase as any)
    .from("pm_tasks")
    .select("id, title, status, phase_label, is_gate, client_visible, description, client_content_blocks")
    .eq("project_id", projectId)
    .eq("client_visible", true)
    .neq("status", "cancelled")
    .order("sort_order", { ascending: true });

  const tasks = ((rows ?? []) as {
    id: string;
    title: string;
    status: PmTaskStatus;
    phase_label: string | null;
    is_gate: boolean;
    description?: string | null;
    client_content_blocks?: unknown;
  }[]).filter((t) => t.status !== "blocked");

  return (
    <ClientAccessFlowGate>
      <ClientPortalFrame
        eyebrow="Delivery"
        title="Project board"
        subtitle={`${project.title} — milestones your team can follow. Status is updated by the agency.`}
        actions={
          <ClientProjectSwitcher projects={projects} projectId={projectId} />
        }
      >
        {tasks.length === 0 ? (
          <ClientEmptyState
            title="Nothing on the board yet"
            message="When work is scheduled on this project, tasks will appear here as To do, In progress, and Done."
          />
        ) : (
          <ClientTaskKanban tasks={tasks} />
        )}
      </ClientPortalFrame>
    </ClientAccessFlowGate>
  );
}
