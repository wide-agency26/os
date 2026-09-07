"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { getClientNavState } from "@/app/actions/client-nav";
import { firstClientPortalHref } from "@/lib/client/nav";

export type ClientAccessFlowState =
  | "unverified"
  | "no_company"
  | "pending"
  | "rejected"
  | "active";

export type ClientAccessSnapshot = {
  userId: string;
  userEmail: string;
  companyName: string;
  state: ClientAccessFlowState;
};

function emptySnapshot(): ClientAccessSnapshot {
  return {
    userId: "",
    userEmail: "",
    companyName: "your organization",
    state: "no_company",
  };
}

async function companyLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
): Promise<string> {
  const { data } = await supabase
    .from("crm_customers")
    .select("company, name")
    .eq("id", companyId)
    .maybeSingle();
  return String(data?.company || data?.name || "").trim() || "your organization";
}

export async function loadClientAccessSnapshot(): Promise<ClientAccessSnapshot> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptySnapshot();

  const snapshot: ClientAccessSnapshot = {
    userId: user.id,
    userEmail: user.email || "",
    companyName: "your organization",
    state: "no_company",
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && isFounder(profile.role)) {
    snapshot.state = "active";
    return snapshot;
  }

  if (!user.email_confirmed_at && user.app_metadata?.provider === "email") {
    snapshot.state = "unverified";
    return snapshot;
  }

  // Do not embed crm_customers here — company_id and contact_id both FK to
  // that table, so PostgREST rejects an ambiguous `crm_customers(...)` select
  // and the gate used to treat assigned members as having no company.
  const { data: members, error } = await supabase
    .from("company_members")
    .select("company_id, status")
    .eq("user_id", user.id);

  if (error || !members?.length) {
    snapshot.state = "no_company";
    return snapshot;
  }

  const active = members.find((m) => m.status === "active");
  if (active) {
    snapshot.companyName = await companyLabel(supabase, active.company_id);
    snapshot.state = "active";
    return snapshot;
  }

  const pending = members.find((m) => m.status === "pending");
  if (pending) {
    snapshot.companyName = await companyLabel(supabase, pending.company_id);
    snapshot.state = "pending";
    return snapshot;
  }

  const rejected = members.find((m) => m.status === "rejected");
  if (rejected) {
    snapshot.companyName = await companyLabel(supabase, rejected.company_id);
    snapshot.state = "rejected";
    return snapshot;
  }

  return snapshot;
}

export async function clientPortalHomeHref(): Promise<string> {
  const access = await loadClientAccessSnapshot();
  if (access.state !== "active") return "/app/client-guidelines";
  const nav = await getClientNavState();
  return firstClientPortalHref(nav);
}

export async function requestCompanyAccess(companyId: string): Promise<{
  error?: string;
  state?: "active" | "pending";
  companyName?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };
  if (!companyId) return { error: "Pick a company." };

  const name = await companyLabel(supabase, companyId);

  const { data: existing } = await supabase
    .from("company_members")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing?.status === "active") {
    return { state: "active", companyName: name };
  }
  if (existing?.status === "pending") {
    return { state: "pending", companyName: name };
  }

  const { error } = await supabase.from("company_members").upsert(
    {
      user_id: user.id,
      company_id: companyId,
      status: "pending",
      source: "self_service",
    },
    { onConflict: "user_id,company_id" }
  );
  if (error) return { error: error.message };
  return { state: "pending", companyName: name };
}
