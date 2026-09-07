"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { isUuid } from "@/lib/routing";
import { VIEW_AS_COMPANY_COOKIE, VIEW_AS_CONTACT_COOKIE, VIEW_AS_RETURN_COOKIE, safeViewAsReturnPath } from "@/lib/client/view-as";
import { readViewAsCompanyId, readViewAsContactId, writeViewAsCookies, viewAsCookieOptions } from "@/lib/client/view-as.server";
import { workPaths } from "@/lib/work/paths";
import { isClientNavKey, type ClientNavKey } from "@/lib/client/nav";
import {
  parseAllowedNavTabs,
  parsePortalAccess,
  type PortalAccessLevel,
} from "@/lib/client/permissions";

function cookieOptions() {
  return viewAsCookieOptions();
}

async function requireFounderUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, supabase, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isFounder(profile.role)) {
    return { ok: false as const, supabase, user };
  }
  return { ok: true as const, supabase, user };
}

export async function startViewAsClient(
  companyId: string,
  contactId?: string | null,
  opts?: { next?: string | null; clearReturn?: boolean }
): Promise<{ error?: string }> {
  const gate = await requireFounderUser();
  if (!gate.ok) return { error: "Founder access required." };
  if (!isUuid(companyId)) return { error: "Choose a client." };

  const { data: company } = await gate.supabase
    .from("crm_customers")
    .select("id")
    .eq("id", companyId)
    .eq("record_kind", "company")
    .maybeSingle();

  if (!company) return { error: "That company was not found." };

  let resolvedContact: string | null = null;
  if (contactId) {
    if (!isUuid(contactId)) return { error: "Choose a contact." };
    const { data: contact } = await gate.supabase
      .from("crm_customers")
      .select("id, record_kind, parent_company_id")
      .eq("id", contactId)
      .maybeSingle();
    if (!contact || contact.record_kind === "company") {
      return { error: "That contact was not found." };
    }
    if (contact.parent_company_id !== companyId) {
      return { error: "That person is not recorded on this company." };
    }
    resolvedContact = contact.id;
  }

  await writeViewAsCookies(
    companyId,
    resolvedContact,
    opts?.clearReturn ? null : undefined
  );
  const next = String(opts?.next || "").trim();
  if (next.startsWith("/app/client-") && !next.startsWith("//")) {
    redirect(next);
  }
  redirect("/app/client-guidelines");
}

export async function startCiClientPreview(
  projectId: string
): Promise<{ error?: string }> {
  const gate = await requireFounderUser();
  if (!gate.ok) return { error: "Founder access required." };
  if (!isUuid(projectId)) return { error: "Project not found." };

  const { data: project } = await gate.supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  if (!project.client_id) {
    return {
      error:
        "Attach a CRM company to this project first. View as client opens the portal the way that company will see it.",
    };
  }

  const { data: guideline } = await gate.supabase
    .from("ci_guidelines")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!guideline?.id) {
    return { error: "Save or import something in CI Builder before previewing." };
  }

  const { data: members } = await gate.supabase
    .from("company_members")
    .select("contact_id, portal_access")
    .eq("company_id", project.client_id)
    .eq("status", "active")
    .not("contact_id", "is", null)
    .order("requested_at", { ascending: true });

  const portalMember =
    (members || []).find((m) => m.contact_id) || null;

  await writeViewAsCookies(
    project.client_id,
    portalMember?.contact_id || null,
    `/app/projects/${projectId}/ci-builder`
  );
  redirect(`/app/client-guidelines/preview/${guideline.id}`);
}

export async function clearViewAsClient(): Promise<void> {
  const jar = await cookies();
  const back = safeViewAsReturnPath(jar.get(VIEW_AS_RETURN_COOKIE)?.value || null);
  jar.set(VIEW_AS_COMPANY_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  jar.set(VIEW_AS_CONTACT_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  jar.set(VIEW_AS_RETURN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  redirect(back || workPaths.clients);
}

export async function getViewAsCompany(): Promise<{ id: string; name: string } | null> {
  const preview = await getViewAsPreview();
  if (!preview) return null;
  return { id: preview.companyId, name: preview.companyName };
}

export type ViewAsPreview = {
  companyId: string;
  companyName: string;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  isMember: boolean;
  portalAccess: PortalAccessLevel;
  allowedNavTabs: ClientNavKey[] | null;
  contacts: ViewAsContactOption[];
  returnHref: string | null;
};

export type ViewAsContactOption = {
  id: string;
  name: string;
  email: string | null;
  isMember: boolean;
  projectTitles: string[];
  portalAccess: PortalAccessLevel;
  allowedNavTabs: ClientNavKey[] | null;
};

export async function getViewAsPreview(): Promise<ViewAsPreview | null> {
  const id = await readViewAsCompanyId();
  if (!id) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_customers")
    .select("id, company, name")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const companyName = (data.company || data.name || "Client").trim();
  const contacts = await loadContactsForCompany(supabase, id);
  const contactId = await readViewAsContactId();
  const selected = contactId ? contacts.find((c) => c.id === contactId) : null;
  const jar = await cookies();
  const returnHref = safeViewAsReturnPath(jar.get(VIEW_AS_RETURN_COOKIE)?.value || null);

  return {
    companyId: data.id,
    companyName,
    contactId: selected?.id ?? null,
    contactName: selected?.name ?? null,
    contactEmail: selected?.email ?? null,
    isMember: selected?.isMember ?? false,
    portalAccess: selected?.portalAccess ?? "full",
    allowedNavTabs: selected?.allowedNavTabs ?? null,
    contacts,
    returnHref,
  };
}

async function loadContactsForCompany(
  supabase: any,
  companyId: string
): Promise<ViewAsContactOption[]> {
  const [{ data: people }, { data: members }, { data: links }] = await Promise.all([
    supabase
      .from("crm_customers")
      .select("id, name, email")
      .eq("record_kind", "contact")
      .eq("parent_company_id", companyId)
      .order("name"),
    supabase
      .from("company_members")
      .select("contact_id, portal_access, allowed_nav_tabs")
      .eq("company_id", companyId)
      .eq("status", "active"),
    supabase
      .from("project_deal_contacts")
      .select("contact_id, projects!inner ( title, client_id, client_visible )"),
  ]);

  const memberByContact = new Map<
    string,
    { access: PortalAccessLevel; tabs: ClientNavKey[] | null }
  >();
  for (const m of members ?? []) {
    if (!m.contact_id) continue;
    memberByContact.set(m.contact_id, {
      access: parsePortalAccess(m.portal_access),
      tabs: parseAllowedNavTabs(m.allowed_nav_tabs as string[] | null),
    });
  }

  const projectsByContact = new Map<string, string[]>();
  for (const row of links ?? []) {
    const proj = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    if (!proj || (proj as { client_id?: string }).client_id !== companyId) continue;
    if ((proj as { client_visible?: boolean }).client_visible === false) continue;
    const title = String((proj as { title?: string }).title || "").trim();
    if (!title || !row.contact_id) continue;
    const list = projectsByContact.get(row.contact_id) || [];
    if (!list.includes(title)) list.push(title);
    projectsByContact.set(row.contact_id, list);
  }

  return (people ?? []).map((p: { id: string; name: string | null; email: string | null }) => {
    const member = memberByContact.get(p.id);
    return {
      id: p.id,
      name: (p.name || "Contact").trim(),
      email: p.email,
      isMember: Boolean(member),
      projectTitles: projectsByContact.get(p.id) || [],
      portalAccess: member?.access || "full",
      allowedNavTabs: member?.tabs ?? null,
    };
  }).sort((a: ViewAsContactOption, b: ViewAsContactOption) => {
    if (a.isMember !== b.isMember) return a.isMember ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export type ViewAsCatalogCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  projectTitle: string | null;
  contacts: ViewAsContactOption[];
};

export async function loadViewAsCatalog(
  companies: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    website: string | null;
    projectTitle: string | null;
  }>
): Promise<ViewAsCatalogCompany[]> {
  const gate = await requireFounderUser();
  if (!gate.ok) return [];
  const ids = companies.map((c) => c.id);
  if (!ids.length) return companies.map((c) => ({ ...c, contacts: [] }));

  const results = await Promise.all(ids.map((id) => loadContactsForCompany(gate.supabase, id)));
  return companies.map((c, i) => ({ ...c, contacts: results[i] || [] }));
}

export async function setMemberPortalAccess(
  memberId: string,
  access: PortalAccessLevel,
  tabs?: ClientNavKey[] | null
): Promise<{ error?: string }> {
  const gate = await requireFounderUser();
  if (!gate.ok) return { error: "Founder access required." };
  if (!isUuid(memberId)) return { error: "Member not found." };

  const allowed =
    access === "restricted"
      ? (tabs || []).filter(isClientNavKey).filter((k) => k !== "files")
      : null;
  if (access === "restricted" && (!allowed || allowed.length === 0)) {
    return { error: "Pick at least one portal tab for restricted access." };
  }

  const { error } = await gate.supabase
    .from("company_members")
    .update({
      portal_access: access,
      allowed_nav_tabs: allowed,
    })
    .eq("id", memberId);
  if (error) return { error: error.message };
  return {};
}
