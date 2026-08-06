"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { isFounder } from "@/lib/rbac";

export type CompanyMemberRow = {
  id: string;
  user_id: string;
  company_id: string;
  status: string;
  source: string;
  requested_at: string;
  user_email: string;
  user_name: string;
  company_name: string;
};

export type CompanyOption = { id: string; name: string };

export type CompanyUsersState = { error?: string; success?: string };

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
    .order("company");

  const companies: CompanyOption[] = (crmData ?? []).map((c) => ({
    id: c.id,
    name: companyLabel(c),
  }));
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  let membersQuery = admin
    .from("company_members")
    .select("id, user_id, company_id, status, source, requested_at")
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
    status: m.status,
    source: m.source,
    requested_at: m.requested_at,
    user_email: emailMap.get(m.user_id) || m.user_id,
    user_name: profileMap.get(m.user_id) || "Client User",
    company_name: companyMap.get(m.company_id) || "Unknown Company",
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

export async function inviteCompanyUser(
  _prev: CompanyUsersState,
  formData: FormData
): Promise<CompanyUsersState> {
  const gate = await requireFounder();
  if (!gate.ok) return { error: gate.error };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const company_id = String(formData.get("company_id") ?? "").trim();

  if (!email || !full_name || !company_id) {
    return { error: "Name, email, and company are required." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { error: `${msg} Add SUPABASE_SERVICE_ROLE_KEY for invitations.` };
  }

  const { data: company, error: companyErr } = await admin
    .from("crm_customers")
    .select("id, company, name")
    .eq("id", company_id)
    .maybeSingle();

  if (companyErr || !company) {
    return { error: companyErr?.message || "Company not found." };
  }

  const company_name = companyLabel(company);
  const site = getSiteUrl();
  const redirectTo = `${site}/auth/callback?next=${encodeURIComponent("/app/client-guidelines")}`;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name,
      company_name,
      portal_role: "client",
    },
    redirectTo,
  });

  if (inviteError) {
    // If user already exists, try to look them up and link instead
    if (/already|registered|exists/i.test(inviteError.message)) {
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = listed?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) {
        return { error: inviteError.message };
      }
      return linkUserToCompany(existing.id, company_id, company_name, gate.user.id, email);
    }
    return { error: inviteError.message };
  }

  const userId = invited.user?.id;
  if (!userId) {
    return { error: "Invite sent but user id was missing." };
  }

  // Ensure profile role/company (trigger usually creates the row)
  await admin.from("profiles").upsert(
    {
      id: userId,
      full_name,
      company_name,
      role: "client",
    },
    { onConflict: "id" }
  );

  const { error: memberErr } = await admin.from("company_members").upsert(
    {
      user_id: userId,
      company_id,
      status: "active",
      source: "admin_added",
      reviewed_by: gate.user.id,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" }
  );

  if (memberErr) {
    return { error: `User invited, but company link failed: ${memberErr.message}` };
  }

  revalidatePath("/app/crm/users");
  revalidatePath("/app/client-access");
  return {
    success: `Invitation sent to ${email}. They’re linked to ${company_name} and can sign in from the invite email.`,
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

  await admin
    .from("profiles")
    .update({ company_name: companyName, role: "client" })
    .eq("id", userId);

  const { error } = await admin.from("company_members").upsert(
    {
      user_id: userId,
      company_id: companyId,
      status: "active",
      source: "admin_added",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/app/crm/users");
  revalidatePath("/app/client-access");
  return {
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

  revalidatePath("/app/crm/users");
  revalidatePath("/app/client-access");
  return { success: "Access revoked." };
}
