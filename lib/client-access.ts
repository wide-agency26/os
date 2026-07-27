import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canVisitAdminUi,
  isUuid,
} from "@/lib/routing";
import {
  isClient,
  isClientManager,
  isSuperadmin,
  normalizeRole,
} from "@/lib/rbac";
import { getWorkspaceClientId } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";

export type ClientPortalAccess = {
  ok: true;
  userId: string;
  role: string;
  clientId: string;
  readOnly: boolean;
};

export type ClientPortalDenied = {
  ok: false;
  reason: "unauthenticated" | "forbidden" | "invalid_client";
};

/** App-layer guard; RLS is the source of truth for data. */
export async function getClientPortalAccess(
  requestedClientId: string
): Promise<ClientPortalAccess | ClientPortalDenied> {
  if (!isUuid(requestedClientId)) {
    return { ok: false, reason: "invalid_client" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "client";

  if (isSuperadmin(role) || isClientManager(role)) {
    const allowed = await canAccessClientInDb(supabase, requestedClientId);
    if (!allowed && !isSuperadmin(role)) {
      return { ok: false, reason: "forbidden" };
    }
    if (!allowed && isSuperadmin(role)) {
      // Superadmin may open any client workspace (impersonation / preview).
    }
    return {
      ok: true,
      userId: user.id,
      role,
      clientId: requestedClientId,
      readOnly: isClientManager(role) && !isSuperadmin(role),
    };
  }

  if (isClient(role)) {
    const workspaceId = await getWorkspaceClientId(supabase, user.id);
    if (workspaceId !== requestedClientId) {
      return { ok: false, reason: "forbidden" };
    }
    return {
      ok: true,
      userId: user.id,
      role,
      clientId: requestedClientId,
      readOnly: false,
    };
  }

  return { ok: false, reason: "forbidden" };
}

async function canAccessClientInDb(
  supabase: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_access_client", {
    target_client_id: clientId,
  });
  if (error) {
    // Fallback if migration not applied yet
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", clientId)
      .eq("role", "client")
      .maybeSingle();
    return Boolean(profile);
  }
  return Boolean(data);
}

export async function requireClientPortalAccess(
  requestedClientId: string
): Promise<ClientPortalAccess> {
  const access = await getClientPortalAccess(requestedClientId);
  if (!access.ok) {
    if (access.reason === "unauthenticated") redirect("/login");
    redirect("/login?error=access_denied");
  }
  return access;
}

export async function resolveWorkspaceClientIdForUser(): Promise<{
  userId: string;
  workspaceClientId: string;
  role: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "client";
  const workspaceClientId = await getWorkspaceClientId(supabase, user.id);
  return { userId: user.id, workspaceClientId, role };
}

export function canImpersonateClientUi(role: string | null | undefined): boolean {
  return canVisitAdminUi(role) || isClientManager(role);
}

export function normalizeRoleForUi(role: string | null | undefined) {
  return normalizeRole(role);
}
