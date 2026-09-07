"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { isFounder } from "@/lib/rbac";
import { parseAllowedNavTabs, parsePortalAccess, type PortalAccessLevel } from "@/lib/client/permissions";
import type { ClientNavKey } from "@/lib/client/nav";

type AdminClient = ReturnType<typeof createAdminClient>;

export type CompanyMemberRow = {
  id: string;
  user_id: string;
  company_id: string;
  contact_id: string | null;
  status: string;
  source: string;
  requested_at: string;
  user_email: string;
  user_name: string;
  company_name: string;
  portal_access: PortalAccessLevel;
  allowed_nav_tabs: ClientNavKey[] | null;
};

export type CompanyOption = { id: string; name: string };

export type CompanyUsersState = {
  error?: string;
  success?: string;
  emailSent?: boolean;
  alreadyMember?: boolean;
  inviteLink?: string | null;
  portalUrl?: string;
  loginUrl?: string;
  username?: string;
  tempPassword?: string | null;
  contactId?: string | null;
};

export type CompanyContactOption = {
  id: string;
  name: string;
  email: string | null;
  isMember: boolean;
};

export type CompanyPortalMember = {
  id: string;
  status: string;
  user_id: string;
  user_name: string;
  user_email: string;
};

export type CompanyPortalContext = {
  error?: string;
  companyId: string;
  companyName: string;
  contacts: CompanyContactOption[];
  members: CompanyPortalMember[];
  portalUrl: string;
  pipelineId: string | null;
};

function portalHomeUrl() {
  return `${getSiteUrl()}/app/client-guidelines`;
}

function portalLoginUrl(email: string) {
  return `${getSiteUrl()}/login?email=${encodeURIComponent(email)}`;
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function revalidateCrmAccess() {
  revalidatePath("/app/crm/access");
  revalidatePath("/app/crm/users");
  revalidatePath("/app/client-access");
  revalidatePath("/app/home");
  revalidatePath("/app/work", "layout");
  revalidatePath("/app/projects", "layout");
}

async function issueTempPassword(
  admin: AdminClient,
  userId: string
): Promise<{ tempPassword?: string; error?: string }> {
  const tempPassword = generateTempPassword();
  const { data } = await admin.auth.admin.getUserById(userId);
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    app_metadata: {
      ...(data.user?.app_metadata ?? {}),
      portal_role: "client",
      must_change_password: true,
    },
  });
  if (error) return { error: error.message };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  return { tempPassword };
}

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isFounder(profile.role)) {
    return { ok: false as const, error: "Founder access required." };
  }

  return { ok: true as const, user, supabase };
}

function companyLabel(row: { company: string | null; name: string | null }) {
  return (row.company || row.name || "Untitled Org").trim();
}

export async function loadCompanyUsersData(companyId?: string): Promise<{
  error?: string;
  companies: CompanyOption[];
  members: CompanyMemberRow[];
  existingClients: { id: string; full_name: string }[];
}> {
  const gate = await requireFounder();
  if (!gate.ok) {
    return { error: gate.error, companies: [], members: [], existingClients: [] };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Missing service role key";
    return { error: msg, companies: [], members: [], existingClients: [] };
  }

  const { data: crmData } = await admin
          .from("crm_customers")
          .select("id, company, name")
          .eq("record_kind", "company")
          .is("archived_at", null)
          .order("company");

  const companies: CompanyOption[] = (crmData ?? []).map((c) => ({
    id: c.id,
    name: companyLabel(c),
  }));
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  let membersQuery = admin
    .from("company_members")
    .select("id, user_id, company_id, contact_id, status, source, requested_at, portal_access, allowed_nav_tabs")
    .order("requested_at", { ascending: false });

  if (companyId) {
    membersQuery = membersQuery.eq("company_id", companyId);
  }

  const { data: membersData, error: membersErr } = await membersQuery;
  if (membersErr) {
    return { error: membersErr.message, companies, members: [], existingClients: [] };
  }

  const { data: profiles } = await admin.from("profiles").select("id, full_name, role");
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Client User"])
  );

  const emailMap = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data.users) {
      if (u.email) emailMap.set(u.id, u.email);
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 20) break;
  }

  const members: CompanyMemberRow[] = (membersData ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    company_id: m.company_id,
    contact_id: m.contact_id ?? null,
    status: m.status,
    source: m.source,
    requested_at: m.requested_at,
    user_email: emailMap.get(m.user_id) || m.user_id,
    user_name: profileMap.get(m.user_id) || "Client User",
    company_name: companyMap.get(m.company_id) || "Unknown Company",
    portal_access: parsePortalAccess(m.portal_access),
    allowed_nav_tabs: parseAllowedNavTabs(m.allowed_nav_tabs as string[] | null),
  }));

  const existingClients = (profiles ?? [])
    .filter((p) => p.role === "client")
    .map((p) => ({
      id: p.id,
      full_name: `${p.full_name?.trim() || "Client User"}${
        emailMap.get(p.id) ? ` (${emailMap.get(p.id)})` : ""
      }`,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return { companies, members, existingClients };
}

/** Pending portal requests — same rows as CRM Access, for Home and the inbox. */
export async function loadPendingCompanyAccess(): Promise<CompanyMemberRow[]> {
  const gate = await requireFounder();
  if (!gate.ok) return [];

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { data: membersData, error } = await admin
    .from("company_members")
    .select("id, user_id, company_id, contact_id, status, source, requested_at, portal_access, allowed_nav_tabs")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  if (error || !membersData?.length) return [];

  const companyIds = [...new Set(membersData.map((m) => m.company_id))];
  const userIds = [...new Set(membersData.map((m) => m.user_id))];

  const { data: companies } = await admin
    .from("crm_customers")
    .select("id, company, name")
    .in("id", companyIds);
  const companyMap = new Map(
    (companies ?? []).map((c) => [c.id, companyLabel(c)])
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Client User"])
  );

  const emailMap = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data.user?.email) emailMap.set(id, data.user.email);
    })
  );

  return membersData.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    company_id: m.company_id,
    contact_id: m.contact_id ?? null,
    status: m.status,
    source: m.source,
    requested_at: m.requested_at,
    user_email: emailMap.get(m.user_id) || m.user_id,
    user_name: nameMap.get(m.user_id) || "Client User",
    company_name: companyMap.get(m.company_id) || "Unknown Company",
    portal_access: parsePortalAccess(m.portal_access),
    allowed_nav_tabs: parseAllowedNavTabs(m.allowed_nav_tabs as string[] | null),
  }));
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 30) return null;
  }
}

async function generateActionLink(
  admin: AdminClient,
  type: "invite" | "magiclink",
  email: string,
  redirectTo: string,
  metadata?: Record<string, string>
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo, data: metadata },
  });
  if (error || !data) return { link: null as string | null, userId: null as string | null };
  const props = (data.properties ?? {}) as Record<string, unknown>;
  const link = [props.action_link, props.actionLink].find((v) => typeof v === "string") as
    | string
    | undefined;
  return {
    link: link ?? null,
    userId: data.user?.id ?? null,
  };
}

async function findContactId(
  admin: AdminClient,
  companyId: string,
  email: string,
  contactId?: string | null
): Promise<string | null> {
  if (contactId) return contactId;
  const { data } = await admin
    .from("crm_customers")
    .select("id")
    .eq("record_kind", "contact")
    .eq("parent_company_id", companyId)
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function activateClientMembership(
  admin: AdminClient,
  opts: {
    userId: string;
    companyId: string;
    companyName: string;
    fullName: string;
    reviewerId: string;
    contactId?: string | null;
    mustChangePassword?: boolean;
  }
): Promise<{ error?: string }> {
  await admin.from("profiles").upsert(
    {
      id: opts.userId,
      full_name: opts.fullName,
      company_name: opts.companyName,
      role: "client",
      must_change_password: opts.mustChangePassword ?? false,
    },
    { onConflict: "id" }
  );

  const { error } = await admin.from("company_members").upsert(
    {
      user_id: opts.userId,
      company_id: opts.companyId,
      contact_id: opts.contactId || null,
      status: "active",
      source: "admin_added",
      reviewed_by: opts.reviewerId,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" }
  );
  if (error) return { error: error.message };
  return {};
}

async function resolveCompanyRow(admin: AdminClient, companyId: string) {
  const { data, error } = await admin
    .from("crm_customers")
    .select("id, company, name, record_kind, parent_company_id")
    .eq("id", companyId)
    .maybeSingle();
  if (error || !data) return { error: error?.message || "Company not found." };

  if (data.record_kind === "contact") {
    if (!data.parent_company_id) {
      return { error: "This contact has no parent company. Assign one first." };
    }
    return resolveCompanyRow(admin, data.parent_company_id);
  }

  return {
    id: data.id as string,
    name: companyLabel(data),
  };
}

async function inviteClientToCompany(opts: {
  email: string;
  fullName: string;
  companyId: string;
  contactId?: string | null;
  reviewerId: string;
  sendEmail?: boolean;
}): Promise<CompanyUsersState> {
  const email = opts.email.trim().toLowerCase();
  const fullName = opts.fullName.trim();
  if (!email || !fullName || !opts.companyId) {
    return { error: "Name, email, and company are required." };
  }

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { error: `${msg} Add SUPABASE_SERVICE_ROLE_KEY for invitations.` };
  }

  const company = await resolveCompanyRow(admin, opts.companyId);
  if ("error" in company && company.error) return { error: company.error };
  const companyId = (company as { id: string }).id;
  const companyName = (company as { name: string }).name;
  const portalUrl = portalHomeUrl();
  const loginUrl = portalLoginUrl(email);
  const contactId = await findContactId(admin, companyId, email, opts.contactId);

  if (opts.contactId) {
    await admin.from("crm_customers").update({ email }).eq("id", opts.contactId);
  }

  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    const { data: member } = await admin
      .from("company_members")
      .select("id, status")
      .eq("user_id", existing.id)
      .eq("company_id", companyId)
      .maybeSingle();
    const alreadyActive = member?.status === "active";
    const linked = await activateClientMembership(admin, {
      userId: existing.id,
      companyId,
      companyName,
      fullName,
      reviewerId: opts.reviewerId,
      contactId,
      mustChangePassword: !opts.sendEmail,
    });
    if (linked.error) return { error: linked.error };

    let tempPassword: string | null = null;
    if (!opts.sendEmail) {
      const issued = await issueTempPassword(admin, existing.id);
      if (issued.error) return { error: issued.error };
      tempPassword = issued.tempPassword ?? null;
    }

    revalidateCrmAccess();
    return {
      alreadyMember: alreadyActive,
      emailSent: false,
      username: email,
      tempPassword,
      loginUrl,
      portalUrl,
      contactId,
      inviteLink: loginUrl,
      success: alreadyActive
        ? `${fullName} is already a portal member of ${companyName}. Copy the new temporary password below.`
        : `${email} already had an account — now a portal viewer on ${companyName}. Copy the username and temporary password below.`,
    };
  }

  if (opts.sendEmail) {
    const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/app/client-guidelines")}`;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        company_name: companyName,
        portal_role: "client",
      },
      redirectTo,
    });
    if (inviteErr || !invited.user?.id) {
      return { error: inviteErr?.message || "Could not send the invite email." };
    }
    const linked = await activateClientMembership(admin, {
      userId: invited.user.id,
      companyId,
      companyName,
      fullName,
      reviewerId: opts.reviewerId,
      contactId,
    });
    if (linked.error) {
      return { error: `Invite sent, but company link failed: ${linked.error}` };
    }
    revalidateCrmAccess();
    return {
      emailSent: true,
      username: email,
      loginUrl,
      portalUrl,
      contactId,
      inviteLink: loginUrl,
      success: `Supabase sent an invite to ${email}. The template is generic — next time, skip the email and share the password yourself.`,
    };
  }

  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      company_name: companyName,
      portal_role: "client",
    },
    app_metadata: { portal_role: "client", must_change_password: true },
  });

  if (createErr || !created.user?.id) {
    return { error: createErr?.message || "Could not create the portal user." };
  }

  const linked = await activateClientMembership(admin, {
    userId: created.user.id,
    companyId,
    companyName,
    fullName,
    reviewerId: opts.reviewerId,
    contactId,
    mustChangePassword: true,
  });
  if (linked.error) {
    return { error: `User created, but company link failed: ${linked.error}` };
  }

  revalidateCrmAccess();
  return {
    emailSent: false,
    username: email,
    tempPassword,
    loginUrl,
    portalUrl,
    contactId,
    inviteLink: loginUrl,
    success: `Created a portal login for ${fullName} on ${companyName}. Copy the username and temporary password — they set a new password on first login.`,
  };
}

export async function inviteCompanyUser(
  _prev: CompanyUsersState,
  formData: FormData
): Promise<CompanyUsersState> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  return inviteClientToCompany({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    companyId: String(formData.get("company_id") ?? ""),
    reviewerId: gate.user.id,
    sendEmail: String(formData.get("send_email") ?? "") === "1",
  });
}

export async function inviteContactAsMember(input: {
  companyId?: string | null;
  contactId?: string | null;
  email?: string | null;
  fullName?: string | null;
  sendEmail?: boolean;
}): Promise<CompanyUsersState> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { error: `${msg} Add SUPABASE_SERVICE_ROLE_KEY for invitations.` };
  }

  let companyId = input.companyId?.trim() || "";
  let email = input.email?.trim() || "";
  let fullName = input.fullName?.trim() || "";
  const contactId = input.contactId?.trim() || "";

  if (contactId) {
    const { data: contact, error } = await admin
      .from("crm_customers")
      .select("id, name, email, record_kind, parent_company_id")
      .eq("id", contactId)
      .maybeSingle();
    if (error || !contact) return { error: error?.message || "Contact not found." };
    if (contact.record_kind === "company") {
      return { error: "Pick a person, not the company, to invite as a portal member." };
    }
    email = email || contact.email || "";
    fullName = fullName || contact.name || "";
    companyId = companyId || contact.parent_company_id || "";
  }

  if (!companyId) {
    return { error: "Assign this contact to a company first." };
  }
  if (!email) {
    return { error: "Add an email on the contact, then invite them." };
  }
  if (!fullName) {
    return { error: "Contact needs a name before they can be invited." };
  }

  return inviteClientToCompany({
    email,
    fullName,
    companyId,
    contactId: contactId || null,
    reviewerId: gate.user.id,
    sendEmail: Boolean(input.sendEmail),
  });
}

export async function loadCompanyPortalContext(
  companyId: string
): Promise<CompanyPortalContext> {
  const empty: CompanyPortalContext = {
    companyId,
    companyName: "",
    contacts: [],
    members: [],
    portalUrl: portalHomeUrl(),
    pipelineId: null,
  };
  const gate = await requireFounder();
  if (!gate.ok) return { ...empty, error: gate.error };

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { ...empty, error: msg };
  }

  const company = await resolveCompanyRow(admin, companyId);
  if ("error" in company && company.error) {
    return { ...empty, error: company.error };
  }
  const resolvedId = (company as { id: string }).id;
  const companyName = (company as { name: string }).name;

  const [{ data: contactRows }, { data: memberRows }, { data: bdRows }] = await Promise.all([
    admin
      .from("crm_customers")
      .select("id, name, email")
      .eq("record_kind", "contact")
      .eq("parent_company_id", resolvedId)
      .order("name"),
    admin
      .from("company_members")
      .select("id, status, user_id")
      .eq("company_id", resolvedId)
      .order("requested_at", { ascending: false }),
    admin
      .from("bd_records")
      .select("id, stage")
      .eq("company_id", resolvedId)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const userIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Client User"])
  );

  const emailMap = new Map<string, string>();
  await Promise.all(
    userIds.slice(0, 12).map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data.user?.email) emailMap.set(id, data.user.email);
      } catch {
        /* ignore auth lookup misses */
      }
    })
  );

  const members: CompanyPortalMember[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    status: m.status,
    user_id: m.user_id,
    user_name: nameMap.get(m.user_id) || "Client User",
    user_email: emailMap.get(m.user_id) || "",
  }));

  const memberEmails = new Set(
    members
      .filter((m) => m.status === "active")
      .map((m) => m.user_email.toLowerCase())
      .filter(Boolean)
  );

  const contacts: CompanyContactOption[] = (contactRows ?? []).map((c) => ({
    id: c.id,
    name: c.name || "Untitled",
    email: c.email,
    isMember: Boolean(c.email && memberEmails.has(c.email.toLowerCase())),
  }));

  const openCard = (bdRows || []).find(
    (r) => r.stage !== "archived" && r.stage !== "declined"
  );
  const pipelineId = openCard?.id || bdRows?.[0]?.id || null;

  return {
    companyId: resolvedId,
    companyName,
    contacts,
    members,
    portalUrl: portalHomeUrl(),
    pipelineId,
  };
}

export async function loadCrmContactBrief(contactId: string): Promise<{
  error?: string;
  id?: string;
  name?: string;
  email?: string | null;
  companyId?: string | null;
}> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Configuration error" };
  }

  const { data, error } = await admin
    .from("crm_customers")
    .select("id, name, email, parent_company_id, record_kind")
    .eq("id", contactId)
    .maybeSingle();
  if (error || !data) return { error: error?.message || "Contact not found." };
  return {
    id: data.id,
    name: data.name || "",
    email: data.email,
    companyId:
      data.record_kind === "company" ? data.id : data.parent_company_id,
  };
}

async function linkUserToCompany(
  userId: string,
  companyId: string,
  companyName: string,
  reviewerId: string,
  email: string
): Promise<CompanyUsersState> {
  const admin = createAdminClient();
  const linked = await activateClientMembership(admin, {
    userId,
    companyId,
    companyName,
    fullName: email,
    reviewerId,
  });
  if (linked.error) return { error: linked.error };

  revalidateCrmAccess();
  return {
    portalUrl: portalHomeUrl(),
    success: `${email} already had an account — linked to ${companyName} with active access.`,
  };
}

export async function linkExistingCompanyUser(
  _prev: CompanyUsersState,
  formData: FormData
): Promise<CompanyUsersState> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  const user_id = String(formData.get("user_id") ?? "").trim();
  const company_id = String(formData.get("company_id") ?? "").trim();
  if (!user_id || !company_id) {
    return { error: "User and company are required." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { error: msg };
  }

  const { data: company } = await admin
    .from("crm_customers")
    .select("id, company, name")
    .eq("id", company_id)
    .maybeSingle();

  if (!company) return { error: "Company not found." };

  const company_name = companyLabel(company);
  const { data: authUser } = await admin.auth.admin.getUserById(user_id);
  const email = authUser.user?.email || user_id;

  return linkUserToCompany(user_id, company_id, company_name, gate.user.id, email);
}

export async function revokeCompanyUser(memberId: string): Promise<CompanyUsersState> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { error: msg };
  }

  const { error } = await admin.from("company_members").delete().eq("id", memberId);
  if (error) return { error: error.message };

  revalidateCrmAccess();
  return { success: "Access revoked." };
}

export async function reviewCompanyMember(
  memberId: string,
  decision: "active" | "rejected"
): Promise<CompanyUsersState> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { error: msg };
  }

  const { data: row, error: fetchErr } = await admin
    .from("company_members")
    .select("id, user_id, company_id")
    .eq("id", memberId)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Request not found." };

  const { error } = await admin
    .from("company_members")
    .update({
      status: decision,
      reviewed_by: gate.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", memberId);
  if (error) return { error: error.message };

  if (decision === "active") {
    const { data: company } = await admin
      .from("crm_customers")
      .select("company, name")
      .eq("id", row.company_id)
      .maybeSingle();
    if (company) {
      await admin
        .from("profiles")
        .update({ company_name: companyLabel(company) })
        .eq("id", row.user_id);
    }
  }

  revalidateCrmAccess();
  return { success: decision === "active" ? "Access approved." : "Request rejected." };
}

export async function createCrmContactFromMember(memberId: string): Promise<{
  error?: string;
  contactId?: string;
}> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Configuration error" };
  }

  const { data: member, error } = await admin
    .from("company_members")
    .select("id, user_id, company_id, contact_id")
    .eq("id", memberId)
    .maybeSingle();
  if (error || !member) return { error: error?.message || "Member not found." };
  if (member.contact_id) return { contactId: member.contact_id };

  const { data: auth } = await admin.auth.admin.getUserById(member.user_id);
  const email = auth.user?.email || "";
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", member.user_id)
    .maybeSingle();
  const { data: company } = await admin
    .from("crm_customers")
    .select("company, name")
    .eq("id", member.company_id)
    .maybeSingle();

  const name = profile?.full_name?.trim() || email.split("@")[0] || "Portal member";
  const { data: created, error: insErr } = await admin
    .from("crm_customers")
    .insert({
      record_kind: "contact",
      name,
      email: email || null,
      parent_company_id: member.company_id,
      company: companyLabel(company || { company: null, name: null }),
      status: "Client",
      role: "Decision Maker",
      source: "Portal member",
      source_category: "Activation",
    })
    .select("id")
    .single();
  if (insErr || !created) return { error: insErr?.message || "Could not create CRM contact." };

  await admin
    .from("company_members")
    .update({ contact_id: created.id })
    .eq("id", member.id);

  revalidateCrmAccess();
  return { contactId: created.id };
}

export async function resetPortalMemberPassword(memberId: string): Promise<CompanyUsersState> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Configuration error" };
  }

  const { data: member } = await admin
    .from("company_members")
    .select("user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return { error: "Member not found." };

  const { data: auth } = await admin.auth.admin.getUserById(member.user_id);
  const email = auth.user?.email;
  if (!email) return { error: "This member has no email on the account." };

  const issued = await issueTempPassword(admin, member.user_id);
  if (issued.error || !issued.tempPassword) {
    return { error: issued.error || "Could not set a new password." };
  }

  return {
    username: email,
    tempPassword: issued.tempPassword,
    loginUrl: portalLoginUrl(email),
    success: `New temporary password for ${email}. They must set their own password on next login.`,
  };
}

export async function completePortalPasswordChange(newPassword: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const next = newPassword.trim();
  if (next.length < 8) return { ok: false, error: "Use at least 8 characters." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, error: error.message };

  let admin: AdminClient;
  try {
    admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata || {}),
        must_change_password: false,
      },
    });
  } catch {
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  }

  return { ok: true };
}
