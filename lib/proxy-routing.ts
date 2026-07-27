import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  assertRouteAllowed,
  homePathForRole,
  isClientPortalPath,
  isUuid,
  parseClientPortalPath,
} from "@/lib/routing";
import { resolveLegacyRedirect } from "@/lib/wide-os/legacy-redirects";
import { clientPaths } from "@/lib/wide-os/paths";
import { isClient, isSuperadmin, normalizeRole } from "@/lib/rbac";

const PUBLIC_PREFIXES = ["/login", "/auth"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function getProfileRole(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

async function getProspectIdForUser(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("prospect_id")
    .eq("id", userId)
    .maybeSingle();
  const pid = data?.prospect_id;
  return typeof pid === "string" ? pid : null;
}

async function getWorkspaceClientId(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("primary_account_id")
    .eq("id", userId)
    .maybeSingle();
  const primary = data?.primary_account_id;
  if (primary && typeof primary === "string") return primary;
  return userId;
}

async function rpcCanAccessClient(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase.rpc("can_access_client", {
    target_client_id: clientId,
  });
  if (error) return false;
  return Boolean(data);
}

function redirectTo(request: NextRequest, targetPath: string) {
  const url = new URL(targetPath, request.nextUrl.origin);
  return NextResponse.redirect(url);
}

export async function applyProxyRouting(
  request: NextRequest,
  supabase: SupabaseClient,
  user: User | null
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;

  if (!user) {
    if (!isPublicPath(path)) return redirectTo(request, "/login");
    return null;
  }

  const actualRole = await getProfileRole(supabase, user.id);
  const workspaceId = await getWorkspaceClientId(supabase, user.id);
  const profileProspectId = await getProspectIdForUser(supabase, user.id);
  const role = actualRole;
  const routeRole = normalizeRole(role);
  const contextClientId = workspaceId;
  const contextProspectId = profileProspectId ?? undefined;

  if (path === "/login" || path === "/") {
    return redirectTo(
      request,
      homePathForRole(role, contextClientId, contextProspectId ?? undefined)
    );
  }

  const legacy = resolveLegacyRedirect(path, contextClientId, request.nextUrl.searchParams);
  if (legacy) {
    return redirectTo(request, legacy);
  }

  const previewMatch = path.match(/^\/admin\/preview\/([0-9a-f-]{36})\/dashboard\/?$/i);
  if (previewMatch) {
    return redirectTo(request, clientPaths.dashboard(previewMatch[1]));
  }

  const routeCheck = assertRouteAllowed(path, routeRole);
  if (!routeCheck.allowed) {
    return redirectTo(request, routeCheck.redirectTo);
  }

  if (isClientPortalPath(path)) {
    const { clientId } = parseClientPortalPath(path);
    if (!clientId || !isUuid(clientId)) {
      return redirectTo(
        request,
        homePathForRole(role, contextClientId, contextProspectId ?? undefined)
      );
    }
    if (isClient(role) && clientId !== contextClientId) {
      const segment = parseClientPortalPath(path).segment ?? "dashboard";
      return redirectTo(request, `/client/${contextClientId}/${segment}`);
    }
    if (!isSuperadmin(actualRole) && !isClient(role)) {
      const allowed = await rpcCanAccessClient(supabase, clientId);
      if (!allowed) {
        return redirectTo(
          request,
          homePathForRole(role, contextClientId, contextProspectId ?? undefined)
        );
      }
    }
  }

  if (path.match(/^\/cm\/[0-9a-f-]{36}/i) || path.match(/^\/admin\/cm\/[0-9a-f-]{36}/i)) {
    const parts = path.split("/").filter(Boolean);
    const clientId = parts[0] === "admin" ? parts[2] : parts[1];
    if (clientId && !isSuperadmin(actualRole)) {
      const allowed = await rpcCanAccessClient(supabase, clientId);
      if (!allowed) {
        return redirectTo(
          request,
          homePathForRole(role, contextClientId, contextProspectId ?? undefined)
        );
      }
    }
  }

  return null;
}
