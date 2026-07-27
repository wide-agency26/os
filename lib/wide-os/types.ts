import type { PortalRole } from "@/lib/rbac";

/** How this route may interact with tenant data. */
export type DataPrivilege = "read" | "write";

/** Route zone — determines shell navigation and default guards. */
export type WideZone =
  | "executive"
  | "finance"
  | "bd"
  | "cm"
  | "client"
  | "prospect"
  | "hr";

/**
 * Resolved access passed into shared module views.
 * CM routes use write; client portal uses read; executive bypasses tenant filters in app layer (RLS still applies per role).
 */
export type WideAccess = {
  zone: WideZone;
  privilege: DataPrivilege;
  /** True when superadmin is operating inside /admin/* mirrors */
  executive: boolean;
  userId: string;
  role: PortalRole | string;
  /** Active client tenant for CM / client workspace routes */
  clientId?: string;
  /** Active prospect tenant for BD / prospect routes */
  prospectId?: string;
  /** Base path prefix for links in this shell (e.g. /cm or /admin/cm) */
  basePath: string;
};

export type DepartmentId = "finance" | "bd" | "cm" | "hr";

export type KickoffPhaseId =
  | "phase-1-discovery"
  | "phase-2-creative"
  | "phase-3-alignment"
  | "phase-4-systems"
  | "phase-5-lifecycle";
