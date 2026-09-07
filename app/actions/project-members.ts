"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";

export type ProjectPortalMemberRow = {
  companyMemberId: string;
  userId: string;
  contactId: string | null;
  name: string;
  email: string;
  hasAccess: boolean;
};

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in" as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isFounder(profile?.role)) {
    return { supabase, error: "Founders only" as const };
  }
  return { supabase, error: null as string | null, userId: user.id };
}

/**
 * Org roster for a project’s client company, with project_members grant flags.
 */
export async function loadProjectPortalMembers(
  projectId: string
): Promise<{ error?: string; companyId?: string; members: ProjectPortalMemberRow[] }> {
  const gate = await requireFounder();
  if (gate.error) return { error: gate.error, members: [] };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Admin client unavailable",
      members: [],
    };
  }

  const { data: project } = await admin
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.client_id) {
    return { error: "Project has no company", members: [] };
  }
  const companyId = project.client_id as string;

  const { data: members } = await admin
    .from("company_members")
    .select("id, user_id, contact_id, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("requested_at", { ascending: true });

  const memberRows = (members ?? []) as {
    id: string;
    user_id: string;
    contact_id: string | null;
  }[];

  const userIds = [...new Set(memberRows.map((m) => m.user_id))];
  const contactIds = memberRows
    .map((m) => m.contact_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: profiles }, { data: contacts }, { data: grants }] =
    await Promise.all([
      userIds.length
        ? admin.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      contactIds.length
        ? admin
            .from("crm_customers")
            .select("id, name, email")
            .in("id", contactIds)
        : Promise.resolve({
            data: [] as { id: string; name: string | null; email: string | null }[],
          }),
      admin
        .from("project_members")
        .select("company_member_id, status")
        .eq("project_id", projectId)
        .eq("status", "active"),
    ]);

  const profileMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [
      p.id,
      p.full_name?.trim() || "",
    ])
  );
  const contactMap = new Map(
    ((contacts ?? []) as { id: string; name: string | null; email: string | null }[]).map(
      (c) => [c.id, c]
    )
  );
  const emailMap = new Map<string, string>();
  for (const id of userIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data.user?.email) emailMap.set(id, data.user.email);
  }

  const granted = new Set(
    ((grants ?? []) as { company_member_id: string }[]).map(
      (g) => g.company_member_id
    )
  );

  const rows: ProjectPortalMemberRow[] = memberRows.map((m) => {
    const contact = m.contact_id ? contactMap.get(m.contact_id) : null;
    const name =
      String(contact?.name || profileMap.get(m.user_id) || "").trim() || "Member";
    const email = String(contact?.email || emailMap.get(m.user_id) || "").trim();
    return {
      companyMemberId: m.id,
      userId: m.user_id,
      contactId: m.contact_id,
      name,
      email,
      hasAccess: granted.has(m.id),
    };
  });

  return { companyId, members: rows };
}

export async function setProjectMemberAccess(
  projectId: string,
  companyMemberId: string,
  grant: boolean
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireFounder();
  if (gate.error) return { ok: false, error: gate.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Admin client unavailable",
    };
  }

  const { data: project } = await admin
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.client_id) return { ok: false, error: "Project not found" };

  const { data: member } = await admin
    .from("company_members")
    .select("id, company_id, status")
    .eq("id", companyMemberId)
    .maybeSingle();
  if (!member || member.status !== "active") {
    return { ok: false, error: "Member not found" };
  }
  if (member.company_id !== project.client_id) {
    return { ok: false, error: "Member is not in this project’s company" };
  }

  const { error } = await admin.from("project_members").upsert(
    {
      project_id: projectId,
      company_member_id: companyMemberId,
      status: grant ? "active" : "revoked",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,company_member_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/projects/${projectId}/portal`);
  revalidatePath("/app/client-guidelines");
  revalidatePath("/app/client-tasks");
  revalidatePath("/app/client-content");
  revalidatePath("/app/client-blog");
  return { ok: true };
}
