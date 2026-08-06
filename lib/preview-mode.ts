import type { PortalRole } from "@/lib/rbac";
import { isUuid } from "@/lib/routing";
import { clientPaths } from "@/lib/wide-os/paths";

export const PREVIEW_COOKIE_ROLE = "wide_preview_role";
export const PREVIEW_COOKIE_CLIENT = "wide_preview_client_id";
export const PREVIEW_COOKIE_PROSPECT = "wide_preview_prospect_id";

export const PREVIEWABLE_ROLES = [
  "client_manager",
  "accountant",
  "bd_manager",
  "hr_manager",
  "client",
  "prospect",
] as const;

export type PreviewableRole = (typeof PREVIEWABLE_ROLES)[number];

export type PreviewContext = {
  role: PreviewableRole;
  clientId?: string;
  prospectId?: string;
};

export function isPreviewableRole(value: string): value is PreviewableRole {
  return (PREVIEWABLE_ROLES as readonly string[]).includes(value);
}

export function previewRoleLabel(role: PreviewableRole): string {
  switch (role) {
    case "client_manager":
      return "Client Manager";
    case "accountant":
      return "Finance";
    case "bd_manager":
      return "BD Manager";
    case "hr_manager":
      return "HR Manager";
    case "client":
      return "Client";
    case "prospect":
      return "Prospect";
    default:
      return role;
  }
}

export function parsePreviewCookieValues(
  role: string | undefined,
  clientRaw: string | undefined,
  prospectRaw: string | undefined
): PreviewContext | null {
  if (!role || !isPreviewableRole(role)) return null;
  const clientId = clientRaw && isUuid(clientRaw) ? clientRaw : undefined;
  const prospectId = prospectRaw && isUuid(prospectRaw) ? prospectRaw : undefined;
  if (role === "client" && !clientId) return null;
  if (role === "prospect" && !prospectId) return null;
  return { role, clientId, prospectId };
}

export function previewHomePath(preview: PreviewContext): string {
  switch (preview.role) {
    case "client":
      return clientPaths.dashboard(preview.clientId!);
    default:
      return "/app/home";
  }
}

export function effectiveRole(
  actualRole: string | null | undefined,
  preview: PreviewContext | null
): PortalRole | null {
  if (preview) return preview.role;
  return (actualRole ?? null) as PortalRole | null;
}

export function previewRequiresClient(role: PreviewableRole): boolean {
  return role === "client";
}

export function previewRequiresProspect(role: PreviewableRole): boolean {
  return role === "prospect";
}

export function previewOptionalClient(role: PreviewableRole): boolean {
  return role === "client_manager";
}

export function previewOptionalProspect(role: PreviewableRole): boolean {
  return role === "bd_manager";
}

export const departmentHomeByRole: Record<string, string> = {};

/** Read preview from request cookies (proxy / edge). */
export function readPreviewFromRequest(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): PreviewContext | null {
  return parsePreviewCookieValues(
    request.cookies.get(PREVIEW_COOKIE_ROLE)?.value,
    request.cookies.get(PREVIEW_COOKIE_CLIENT)?.value,
    request.cookies.get(PREVIEW_COOKIE_PROSPECT)?.value
  );
}
