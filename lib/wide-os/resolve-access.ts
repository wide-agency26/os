import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getWorkspaceClientId } from "@/lib/workspace";
import {
  isClient,
  isClientManager,
  isSuperadmin,
  normalizeRole,
  type PortalRole,
} from "@/lib/rbac";
import type { DepartmentId, WideAccess, WideZone } from "@/lib/wide-os/types";
import { adminPaths } from "@/lib/wide-os/paths";

async function loadSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    role: (profile?.role ?? "client") as PortalRole | string,
    fullName: profile?.full_name ?? null,
  };
}

function deny(): never {
  redirect("/login?error=access_denied");
}

/** Superadmin operating inside /admin/* — full tenant visibility at app layer. */
export async function resolveExecutiveAccess(): Promise<WideAccess> {
  const session = await loadSession();
  if (!session || !isSuperadmin(session.role)) deny();

  return {
    zone: "executive",
    privilege: "write",
    executive: true,
    userId: session.user.id,
    role: normalizeRole(session.role) ?? "superadmin",
    basePath: "/admin",
  };
}

/** Department route access (finance, bd, hr). */
export async function resolveDepartmentAccess(
  department: DepartmentId
): Promise<WideAccess> {
  const session = await loadSession();
  if (!session) deny();

  const role = normalizeRole(session.role);
  const allowed =
    isSuperadmin(session.role) ||
    (department === "finance" && role === "accountant") ||
    (department === "bd" && role === "bd_manager") ||
    (department === "hr" && role === "hr_manager");

  if (!allowed) deny();

  return {
    zone: department,
    privilege: "write",
    executive: false,
    userId: session.user.id,
    role: role ?? session.role,
    basePath: `/${department}`,
  };
}

/** Executive mirror of a department (/admin/finance/...). */
export async function resolveExecutiveDepartmentAccess(
  department: DepartmentId
): Promise<WideAccess> {
  const exec = await resolveExecutiveAccess();
  return {
    ...exec,
    zone: department,
    basePath: `/admin/${department}`,
  };
}

/** CM workspace — write to client data (populates client read portal). */
export async function resolveCmClientAccess(clientId: string): Promise<WideAccess> {
  const session = await loadSession();
  if (!session) deny();

  if (isSuperadmin(session.role)) {
    return {
      zone: "cm",
      privilege: "write",
      executive: true,
      userId: session.user.id,
      role: normalizeRole(session.role) ?? "superadmin",
      clientId,
      basePath: `/admin/cm/${clientId}`,
    };
  }

  if (!isClientManager(session.role)) deny();

  const { data } = await session.supabase.rpc("can_access_client", {
    target_client_id: clientId,
  });
  if (!data) deny();

  return {
    zone: "cm",
    privilege: "write",
    executive: false,
    userId: session.user.id,
    role: "client_manager",
    clientId,
    basePath: `/admin/dashboard`,
  };
}

/** External client portal — read + approval actions only. */
export async function resolveClientReadAccess(clientId: string): Promise<WideAccess> {
  const session = await loadSession();
  if (!session) deny();

  if (isSuperadmin(session.role)) {
    return {
      zone: "client",
      privilege: "read",
      executive: true,
      userId: session.user.id,
      role: "superadmin",
      clientId,
      basePath: `/client/${clientId}`,
    };
  }

  if (isClientManager(session.role)) {
    const { data } = await session.supabase.rpc("can_access_client", {
      target_client_id: clientId,
    });
    if (!data) deny();
    return {
      zone: "client",
      privilege: "read",
      executive: false,
      userId: session.user.id,
      role: "client_manager",
      clientId,
      basePath: `/client/${clientId}`,
    };
  }

  if (isClient(session.role)) {
    const workspaceId = await getWorkspaceClientId(session.supabase, session.user.id);
    if (workspaceId !== clientId) deny();
    return {
      zone: "client",
      privilege: "read",
      executive: false,
      userId: session.user.id,
      role: "client",
      clientId,
      basePath: `/client/${clientId}`,
    };
  }

  deny();
}

/** Executive CM mirror of a client workspace. */
export async function resolveExecutiveCmClientAccess(
  clientId: string
): Promise<WideAccess> {
  const exec = await resolveExecutiveAccess();
  return {
    ...exec,
    zone: "cm",
    clientId,
    basePath: `/admin/dashboard`,
  };
}

export async function resolveProspectReadAccess(
  prospectId: string
): Promise<WideAccess> {
  const session = await loadSession();
  if (!session) deny();

  const role = normalizeRole(session.role);
  if (isSuperadmin(session.role)) {
    return {
      zone: "prospect",
      privilege: "read",
      executive: true,
      userId: session.user.id,
      role: "superadmin",
      prospectId,
      basePath: `/prospect/${prospectId}`,
    };
  }

  if (role === "prospect") {
    const { data: pr } = await session.supabase
      .from("profiles")
      .select("prospect_id")
      .eq("id", session.user.id)
      .maybeSingle();
    if (pr?.prospect_id !== prospectId) deny();
    return {
      zone: "prospect",
      privilege: "read",
      executive: false,
      userId: session.user.id,
      role: "prospect",
      prospectId,
      basePath: `/prospect/${prospectId}`,
    };
  }

  if (role === "bd_manager") {
    const { data: allowed } = await session.supabase.rpc("can_access_prospect", {
      target_prospect_id: prospectId,
    });
    if (!allowed) deny();
    return {
      zone: "prospect",
      privilege: "read",
      executive: false,
      userId: session.user.id,
      role: "bd_manager",
      prospectId,
      basePath: `/prospect/${prospectId}`,
    };
  }

  deny();

}

export async function resolveBdProspectAccess(
  prospectId: string,
  executive = false
): Promise<WideAccess> {
  if (executive) {
    const exec = await resolveExecutiveAccess();
    return { ...exec, zone: "bd", prospectId, basePath: `/admin/bd` };
  }
  const session = await loadSession();
  if (!session) deny();
  const dept = await resolveDepartmentAccess("bd");
  const { data: allowed } = await session.supabase.rpc("can_access_prospect", {
    target_prospect_id: prospectId,
  });
  if (!allowed) deny();
  return { ...dept, prospectId };
}

/** CM roster list */
export async function resolveCmRosterAccess(executive = false): Promise<WideAccess> {
  if (executive) return resolveExecutiveDepartmentAccess("cm");
  const session = await loadSession();
  if (!session) deny();
  if (!isClientManager(session.role) && !isSuperadmin(session.role)) deny();
  return {
    zone: "cm",
    privilege: "write",
    executive: isSuperadmin(session.role),
    userId: session.user.id,
    role: normalizeRole(session.role) ?? session.role,
    basePath: adminPaths.dashboard(),
  };
}
