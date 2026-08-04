import {
  isClient,
  isFounder,
  isSuperadmin,
  normalizeRole,
  type PortalRole,
} from "@/lib/rbac";
import { adminPaths, clientPaths } from "@/lib/wide-os/paths";

export type SidebarPortalRole = "superadmin" | "client_manager" | "client";

export type ClientPortalSegment =
  | "dashboard"
  | "strategy"
  | "creative"
  | "guidelines"
  | "assets"
  | "settings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** @deprecated Use clientPaths from lib/wide-os/paths */
export function clientPortalPath(clientId: string, segment?: string): string {
  if (!segment || segment === "dashboard") return clientPaths.dashboard(clientId);
  if (segment === "brandbook") return clientPaths.brandbook(clientId);
  if (segment === "library") return clientPaths.library(clientId);
  if (segment === "settings") return clientPaths.settings(clientId);
  return `/client/${clientId}/${segment}`;
}

export function homePathForRole(
  role: string | null | undefined,
  workspaceClientId?: string,
  prospectId?: string
): string {
  const r = normalizeRole(role);
  if (isFounder(r)) return adminPaths.dashboard();
  if (r === "prospect") return "/login";
  if (r === "client") return "/app/client-guidelines";
  if (workspaceClientId) return clientPaths.dashboard(workspaceClientId);
  return "/login";
}

export function isClientPortalPath(pathname: string): boolean {
  return pathname.startsWith("/client/");
}

export function parseClientPortalPath(pathname: string): {
  clientId: string | null;
  segment: string | null;
} {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "client" || !parts[1] || !isUuid(parts[1])) {
    return { clientId: null, segment: null };
  }
  return { clientId: parts[1], segment: parts[2] ?? "dashboard" };
}

export function sidebarRole(
  role: string | null | undefined
): SidebarPortalRole {
  if (isFounder(role)) return "superadmin";
  return "client";
}

export function assertRouteAllowed(
  pathname: string,
  role: PortalRole | null
): { allowed: true } | { allowed: false; redirectTo: string } {
  const r = role;

  // Protect /app/... staff routes
  if (pathname.startsWith("/app")) {
    const isClientAllowedAppRoute = pathname === "/app/client-guidelines" || pathname === "/app/home";
    if (!isFounder(r) && !isClientAllowedAppRoute) {
      return { allowed: false, redirectTo: "/app/client-guidelines" };
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!isFounder(r)) {
      return { allowed: false, redirectTo: homePathForRole(r) };
    }
  }

  if (pathname.startsWith("/prospect")) {
    if (r !== "prospect" && !isFounder(r)) {
      return { allowed: false, redirectTo: homePathForRole(r) };
    }
  }

  if (pathname.startsWith("/partner")) {
    if (!isFounder(r) && r !== "client") {
      return { allowed: false, redirectTo: homePathForRole(r) };
    }
  }

  if (isClient(r) && (pathname.startsWith("/admin") || (pathname.startsWith("/app") && pathname !== "/app/client-guidelines" && pathname !== "/app/home"))) {
    return { allowed: false, redirectTo: "/app/client-guidelines" };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Backward-compat shims — all map to isFounder().
// @deprecated
// ---------------------------------------------------------------------------

/** @deprecated All founders have admin access */
export function canVisitAdminUi(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated All founders have CM access */
export function canVisitCmUi(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated All founders have finance access */
export function canVisitFinanceUi(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated All founders have BD access */
export function canVisitBdUi(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated All founders have HR access */
export function canVisitHrUi(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated */
export function canVisitProspectUi(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "prospect" || isFounder(role);
}

