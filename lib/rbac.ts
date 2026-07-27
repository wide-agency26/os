/** Portal roles stored in public.profiles.role */
export type PortalRole =
  | "superadmin"
  | "admin" // legacy alias — treated as superadmin
  | "accountant"
  | "bd_manager"
  | "client_manager"
  | "client"
  | "prospect"
  | "hr_manager";

export function normalizeRole(role: string | null | undefined): PortalRole | null {
  if (!role) return null;
  if (role === "admin") return "superadmin";
  return role as PortalRole;
}

export function isClient(role: string | null | undefined): boolean {
  return normalizeRole(role) === "client";
}

/**
 * Streamlined 3-tier user model for the Cockpit era.
 * Legacy department roles (accountant, bd_manager, client_manager, hr_manager)
 * all collapse into the Founder tier — the agency is run by 2 founders.
 */
export type UserTier = "founder" | "client" | "prospect";

export function userTier(role: string | null | undefined): UserTier {
  const r = normalizeRole(role);
  if (r === "client") return "client";
  if (r === "prospect") return "prospect";
  // superadmin + every legacy staff role operate the cockpit as founders
  return "founder";
}

/** Founders have absolute read/write across the entire cockpit. */
export function isFounder(role: string | null | undefined): boolean {
  return userTier(role) === "founder";
}

export function roleLabel(role: string | null | undefined): string {
  switch (normalizeRole(role)) {
    case "superadmin":
      return "Superadmin";
    case "client_manager":
      return "Client Manager";
    case "accountant":
      return "Accountant";
    case "client":
      return "Client";
    case "prospect":
      return "Prospect";
    default:
      return "User";
  }
}

// ---------------------------------------------------------------------------
// Backward-compat shims — all staff roles now map to `isFounder`.
// These exist solely so downstream consumers compile without changes.
// @deprecated — use isFounder() instead.
// ---------------------------------------------------------------------------

/** @deprecated Use isFounder() */
export function isSuperadmin(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated Use isFounder() */
export function isClientManager(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated Use isFounder() */
export function isBdManager(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated Use isFounder() */
export function isHrManager(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated Use isFounder() */
export function isAccountant(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated Use isFinanceStaff → isFounder() */
export function isFinanceStaff(role: string | null | undefined): boolean {
  return isFounder(role);
}

/** @deprecated Use isFounder() */
export function isAgencyStaff(role: string | null | undefined): boolean {
  return isFounder(role);
}

