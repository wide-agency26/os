import {
  CLIENT_NAV_KEYS,
  isClientNavKey,
  type ClientNavAvailability,
  type ClientNavKey,
} from "@/lib/client/nav";

export type PortalAccessLevel = "full" | "restricted";

export function parsePortalAccess(raw: string | null | undefined): PortalAccessLevel {
  return raw === "restricted" ? "restricted" : "full";
}

export function parseAllowedNavTabs(
  raw: string[] | null | undefined
): ClientNavKey[] | null {
  if (!raw || raw.length === 0) return null;
  const next = raw.filter(isClientNavKey);
  return next.length ? next : null;
}

/** Restrict company-level tab flags down to this member's grant. */
export function applyMemberNavAccess(
  enabled: ClientNavAvailability,
  access: PortalAccessLevel,
  allowedTabs: ClientNavKey[] | null
): ClientNavAvailability {
  if (access !== "restricted") return enabled;
  const allow = new Set(allowedTabs && allowedTabs.length ? allowedTabs : []);
  const next = { ...enabled };
  for (const key of CLIENT_NAV_KEYS) {
    if (key === "files") {
      next[key] = false;
      continue;
    }
    next[key] = Boolean(enabled[key] && allow.has(key));
  }
  return next;
}

export function portalAccessLabel(access: PortalAccessLevel): string {
  return access === "restricted" ? "Restricted" : "Full portal";
}
