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
import { verifyPrintToken } from "@/lib/pdf/print-token";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  CLIENT_NAV_HREF,
  clientNavKeyFromPath,
  firstEnabledClientHref,
  unionClientNavTabs,
  type ClientNavKey,
} from "@/lib/client/nav";
import { applyMemberNavAccess, parseAllowedNavTabs, parsePortalAccess } from "@/lib/client/permissions";

const PUBLIC_PREFIXES = ["/login", "/auth", "/g", "/s", "/a", "/n", "/p", "/r"];

/**
 * Machine-to-machine endpoints: cron invocations and the SEO background worker
 * arrive without a session cookie, so redirecting them to /login would break
 * them silently. Each of these routes authenticates itself with a shared secret
 * (`CRON_SECRET` / `SEO_WORKER_SECRET`) or Vercel's `x-vercel-cron` header, so
 * they must be exempted here rather than left to session auth.
 */
const MACHINE_PREFIXES = ["/api/cron", "/api/seo/worker", "/api/mcp"];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/api/pdf" || pathname.startsWith("/api/pdf/")) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Headless Chrome hits print layouts with an HMAC token, not a user session. */
export function isSignedPrintPath(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  if (!path.includes("/print")) return false;
  return Boolean(verifyPrintToken(request.nextUrl.searchParams.get("token")));
}

export function isMachinePath(pathname: string): boolean {
  return MACHINE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type ProfileRoutingRow = {
  role: string | null;
  primary_account_id: string | null;
  prospect_id: string | null;
};

async function getProfileRouting(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRoutingRow> {
  const { data } = await supabase
    .from("profiles")
    .select("role, primary_account_id, prospect_id")
    .eq("id", userId)
    .maybeSingle();
  return {
    role: data?.role ?? null,
    primary_account_id:
      typeof data?.primary_account_id === "string"
        ? data.primary_account_id
        : null,
    prospect_id:
      typeof data?.prospect_id === "string" ? data.prospect_id : null,
  };
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

async function blockedClientNavRedirect(
  supabase: SupabaseClient,
  userId: string,
  navKey: ClientNavKey
): Promise<string | null> {
  const { data: members } = await supabase
    .from("company_members")
    .select("company_id, portal_access, allowed_nav_tabs")
    .eq("user_id", userId)
    .eq("status", "active");
  const rows = (members ?? []) as Array<{
    company_id: string;
    portal_access: string | null;
    allowed_nav_tabs: string[] | null;
  }>;
  const companyIds = rows.map((m) => m.company_id).filter(Boolean);
  if (!companyIds.length) return null;

  const admin = createAdminClient();
  const { data: projects } = await admin
    .from("projects")
    .select("client_nav_tabs, client_progress, id")
    .eq("client_visible", true)
    .in("client_id", companyIds);
  const enabledSet = unionClientNavTabs(projects ?? []);
  const flags: Partial<Record<ClientNavKey, boolean>> = {};
  for (const key of enabledSet) flags[key] = true;

  const progressReady = (projects ?? []).some((p) => {
    const raw = (p as { client_progress?: unknown }).client_progress;
    if (!raw || typeof raw !== "object") return false;
    const o = raw as Record<string, unknown>;
    return Boolean(o.show_on_client && o.published_at);
  });
  if (progressReady) flags.progress = true;

  let access = parsePortalAccess("full");
  let allowed = null as ReturnType<typeof parseAllowedNavTabs>;
  if (rows.length && rows.every((m) => parsePortalAccess(m.portal_access) === "restricted")) {
    access = "restricted";
    const allow = new Set<ClientNavKey>();
    for (const m of rows) {
      for (const key of parseAllowedNavTabs(m.allowed_nav_tabs) || []) allow.add(key);
    }
    allowed = [...allow];
  }
  const gated = applyMemberNavAccess(
    {
      progress: Boolean(flags.progress),
      guidelines: Boolean(flags.guidelines),
      reports: Boolean(flags.reports),
      seo: Boolean(flags.seo),
      content: Boolean(flags.content),
      blog: Boolean(flags.blog),
      tasks: Boolean(flags.tasks),
      sow: Boolean(flags.sow),
      files: false,
    },
    access,
    allowed
  );
  if (gated[navKey]) return null;

  const dest = firstEnabledClientHref(gated);
  if (dest === CLIENT_NAV_HREF[navKey]) return null;
  return dest;
}

export async function applyProxyRouting(
  request: NextRequest,
  supabase: SupabaseClient,
  user: User | null
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;

  if (isMachinePath(path)) return null;
  if (isSignedPrintPath(request)) return null;

  if (!user) {
    if (!isPublicPath(path)) return redirectTo(request, "/login");
    return null;
  }

  const profile = await getProfileRouting(supabase, user.id);
  const actualRole = profile.role;
  const workspaceId = profile.primary_account_id || user.id;
  const profileProspectId = profile.prospect_id;
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

  if (isClient(role) && path.startsWith("/app/client-")) {
    const navKey = clientNavKeyFromPath(path);
    if (navKey) {
      try {
        const dest = await blockedClientNavRedirect(supabase, user.id, navKey);
        if (dest) return redirectTo(request, dest);
      } catch {
        /* keep going if the lookup fails */
      }
    }
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
