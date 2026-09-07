export type ClientProjectOption = {
  id: string;
  title: string;
  client_id?: string | null;
};

type Sb = {
  from: (table: string) => any;
};

/**
 * Projects a portal user may open.
 * - Must belong to their company (no HQ bleed across companies).
 * - If the member has any project_members grants, only those projects.
 * - Else (legacy companies without ACL rows) all client_visible projects for the company.
 */
export async function loadClientScopedProjects(
  supabase: Sb,
  opts: {
    userId: string;
    staff: boolean;
    viewAsCompanyId?: string | null;
    /** When staff previews a contact, filter by that contact's grants. */
    viewAsContactId?: string | null;
  }
): Promise<{ companyIds: string[]; projects: ClientProjectOption[] }> {
  let companyIds: string[] = [];
  let memberIds: string[] = [];

  if (!opts.staff) {
    const { data: memberships } = await supabase
      .from("company_members")
      .select("id, company_id")
      .eq("user_id", opts.userId)
      .eq("status", "active");
    const rows = (memberships ?? []) as { id: string; company_id: string }[];
    companyIds = rows.map((m) => m.company_id);
    memberIds = rows.map((m) => m.id);
    if (!companyIds.length) return { companyIds, projects: [] };
  } else if (opts.viewAsCompanyId) {
    companyIds = [opts.viewAsCompanyId];
    if (opts.viewAsContactId) {
      const { data: mem } = await supabase
        .from("company_members")
        .select("id")
        .eq("company_id", opts.viewAsCompanyId)
        .eq("contact_id", opts.viewAsContactId)
        .eq("status", "active")
        .maybeSingle();
      if (mem?.id) memberIds = [mem.id as string];
    }
  }

  let query = supabase
    .from("projects")
    .select("id, title, client_id")
    .eq("client_visible", true)
    .order("title");
  if (companyIds.length) query = query.in("client_id", companyIds);

  const { data } = await query;
  let projects = ((data ?? []) as ClientProjectOption[]).map((p) => ({
    id: p.id,
    title: p.title,
    client_id: p.client_id,
  }));

  if (memberIds.length) {
    const { data: grants } = await supabase
      .from("project_members")
      .select("project_id")
      .in("company_member_id", memberIds)
      .eq("status", "active");
    const granted = new Set(
      ((grants ?? []) as { project_id: string }[]).map((g) => g.project_id)
    );
    if (granted.size > 0) {
      projects = projects.filter((p) => granted.has(p.id));
    }
  }

  return { companyIds, projects };
}

export function pickProjectId(
  projects: { id: string }[],
  requested?: string | null
): string {
  if (requested && projects.some((p) => p.id === requested)) return requested;
  return projects[0]?.id ?? "";
}

/** Prefer a project that already has a shared content calendar (in review / approved). */
export async function pickProjectIdWithSharedContent(
  supabase: Sb,
  projects: { id: string }[],
  requested?: string | null
): Promise<string> {
  if (requested && projects.some((p) => p.id === requested)) return requested;
  const ids = projects.map((p) => p.id).filter(Boolean);
  if (!ids.length) return "";
  const { data } = await supabase
    .from("content_calendars")
    .select("project_id")
    .in("project_id", ids)
    .in("status", ["in_review", "approved"])
    .order("period_start", { ascending: false })
    .limit(40);
  const projectSet = new Set(ids);
  for (const row of (data ?? []) as { project_id: string }[]) {
    if (projectSet.has(row.project_id)) return row.project_id;
  }
  return projects[0]?.id ?? "";
}
