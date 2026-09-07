"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { requireAgencyStaff } from "@/lib/auth-guards";

export type ProjectTeamMember = {
  personId: string;
  fullName: string;
  isLead: boolean;
  authUserId: string | null;
};

export type AssignablePerson = {
  id: string;
  fullName: string;
  authUserId: string | null;
};

async function revalidateProject(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/work");
  revalidatePath("/app/work/clients");
  revalidatePath("/app/home");
}

export async function listAssignablePeople(): Promise<{
  ok: true;
  people: AssignablePerson[];
} | { ok: false; error: string }> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("people")
    .select(
      "id, full_name, auth_user_id, roster_status, kind, engagement_types ( assignable_to_tasks )"
    )
    .eq("roster_status", "active")
    .order("full_name");

  if (error) return { ok: false, error: error.message };

  const people: AssignablePerson[] = (data || [])
    .filter((p: any) => {
      if (p.kind === "bot") return false;
      const eng = Array.isArray(p.engagement_types)
        ? p.engagement_types[0]
        : p.engagement_types;
      return eng?.assignable_to_tasks !== false;
    })
    .map((p: any) => ({
      id: p.id as string,
      fullName: (p.full_name || "Untitled").trim(),
      authUserId: (p.auth_user_id as string | null) || null,
    }));

  return { ok: true, people };
}

export async function loadProjectTeam(projectId: string): Promise<{
  ok: true;
  members: ProjectTeamMember[];
  startDate: string | null;
  expectedStartDate: string | null;
} | { ok: false; error: string }> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const [{ data: proj, error: projErr }, { data: rows, error }] = await Promise.all([
    (supabase as any)
      .from("projects")
      .select("start_date, expected_start_date")
      .eq("id", projectId)
      .maybeSingle(),
    (supabase as any)
      .from("project_team_members")
      .select("person_id, is_lead, people:person_id ( id, full_name, auth_user_id )")
      .eq("project_id", projectId),
  ]);

  if (projErr) return { ok: false, error: projErr.message };
  if (error) return { ok: false, error: error.message };
  if (!proj) return { ok: false, error: "Project not found." };

  const members: ProjectTeamMember[] = (rows || []).map((r: any) => {
    const pe = Array.isArray(r.people) ? r.people[0] : r.people;
    return {
      personId: r.person_id as string,
      fullName: (pe?.full_name || "Untitled").trim(),
      isLead: Boolean(r.is_lead),
      authUserId: (pe?.auth_user_id as string | null) || null,
    };
  });
  members.sort((a, b) => {
    if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
    return a.fullName.localeCompare(b.fullName);
  });

  return {
    ok: true,
    members,
    startDate: proj.start_date || null,
    expectedStartDate: proj.expected_start_date || null,
  };
}

export async function setProjectTeamMembers(
  projectId: string,
  personIds: string[],
  leadPersonId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const unique = Array.from(new Set(personIds.filter(Boolean)));
  const lead =
    leadPersonId && unique.includes(leadPersonId)
      ? leadPersonId
      : unique[0] || null;

  const supabase = await createClient();

  const { error: delErr } = await (supabase as any)
    .from("project_team_members")
    .delete()
    .eq("project_id", projectId);
  if (delErr) return { ok: false, error: delErr.message };

  if (unique.length) {
    const rows = unique.map((person_id) => ({
      project_id: projectId,
      person_id,
      is_lead: person_id === lead,
      updated_at: new Date().toISOString(),
    }));
    const { error: insErr } = await (supabase as any)
      .from("project_team_members")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  // Keep lead_admin_id in sync for home/legacy surfaces.
  let leadAdminId: string | null = null;
  if (lead) {
    const { data: person } = await (supabase as any)
      .from("people")
      .select("auth_user_id")
      .eq("id", lead)
      .maybeSingle();
    leadAdminId = person?.auth_user_id || null;
  }
  const { error: patchErr } = await (supabase as any)
    .from("projects")
    .update({
      lead_admin_id: leadAdminId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (patchErr) return { ok: false, error: patchErr.message };

  await revalidateProject(projectId);
  return { ok: true };
}

export async function updateProjectStartDate(
  projectId: string,
  startDate: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const value = startDate?.trim() || null;
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "Use YYYY-MM-DD." };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("projects")
    .update({
      start_date: value,
      expected_start_date: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  await revalidateProject(projectId);
  return { ok: true };
}
