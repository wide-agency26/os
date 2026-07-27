/**
 * Canonical path migrations from earlier portal iterations.
 */
export const WIDE_OS_LEGACY_REDIRECTS: Record<string, string> = {
  "/admin/work": "/admin/dashboard",
  "/admin/cockpit": "/admin/financials",
  "/admin/bd/dashboard": "/admin/dashboard",
  "/admin/bd/prospects": "/admin/dashboard",
  "/admin/bd/partnerships": "/admin/dashboard",
  "/admin/bd/pipeline": "/admin/dashboard",
  "/admin/bd/marketing": "/admin/dashboard",
  "/admin/bd/tasks": "/admin/dashboard",
  "/bd/dashboard": "/admin/dashboard",
  "/bd/prospects": "/admin/dashboard",
  "/bd/partnerships": "/admin/dashboard",
  "/bd/pipeline": "/admin/dashboard",
  "/bd/marketing": "/admin/dashboard",
  "/bd/tasks": "/admin/dashboard",
  "/admin/hr/dashboard": "/admin/resources",
  "/admin/hr/directory": "/admin/resources",
  "/hr/dashboard": "/admin/resources",
  "/hr/directory": "/admin/resources",
  "/admin/people": "/admin/resources",
  "/dashboard": "/client/__WORKSPACE__/dashboard",
  "/brand-hub": "/client/__WORKSPACE__/brandbook",
  "/style-guide": "/client/__WORKSPACE__/brandbook",
  "/files": "/client/__WORKSPACE__/library",
  "/settings": "/client/__WORKSPACE__/settings",
  "/cm/dashboard": "/admin/clients",
  "/cm/roster": "/admin/clients",
  "/client/__WORKSPACE__/strategy": "/client/__WORKSPACE__/brandbook",
  "/client/__WORKSPACE__/guidelines": "/client/__WORKSPACE__/brandbook",
  "/client/__WORKSPACE__/assets": "/client/__WORKSPACE__/library",
  "/client/__WORKSPACE__/creative": "/client/__WORKSPACE__/services",
  "/client/__WORKSPACE__/webstyleguide": "/client/__WORKSPACE__/brandbook",
  "/client/__WORKSPACE__/brandguideline": "/client/__WORKSPACE__/brandbook",
  "/admin/brand-hub": "/admin/wide-book",
  "/admin/style-guide": "/admin/wide-book",
  "/admin/files": "/admin/dashboard",
  "/admin/cm/roster": "/admin/clients",
  "/admin/cm/settings": "/admin/resources",
};

/** /admin/style-guide?client=<uuid> → CM web style guide workspace */
export function resolveStyleGuideLegacyRedirect(
  path: string,
  searchParams: URLSearchParams
): string | null {
  if (path !== "/admin/style-guide") return null;
  const client = searchParams.get("client");
  if (client && /^[0-9a-f-]{36}$/i.test(client)) {
    return `/admin/cm/${client}/webstyleguide`;
  }
  return WIDE_OS_LEGACY_REDIRECTS[path] ?? null;
}

/** /admin/brand-hub/<uuid> → CM brand guideline */
export function resolveBrandHubLegacyRedirect(path: string): string | null {
  const m = path.match(/^\/admin\/brand-hub\/([0-9a-f-]{36})\/?$/i);
  if (m) return `/client/${m[1]}/brandguideline`;
  const clientM = path.match(/^\/admin\/clients\/([0-9a-f-]{36})\/?$/i);
  if (clientM) return `/client/${clientM[1]}/dashboard`;
  const cmM = path.match(/^\/admin\/cm\/([0-9a-f-]{36})\/(dashboard|brandguideline|webstyleguide|files|settings)\/?$/i);
  if (cmM) {
    const seg = cmM[2];
    if (seg === "dashboard") return `/client/${cmM[1]}/dashboard`;
    if (seg === "brandguideline") return `/client/${cmM[1]}/brandbook`;
    if (seg === "webstyleguide") return `/client/${cmM[1]}/brandbook`;
    if (seg === "files") return `/client/${cmM[1]}/library`;
    if (seg === "settings") return `/client/${cmM[1]}/settings`;
  }
  return null;
}

export function resolveLegacyRedirect(
  path: string,
  workspaceId: string,
  searchParams?: URLSearchParams
): string | null {
  const brandHub = resolveBrandHubLegacyRedirect(path);
  if (brandHub) return brandHub;

  if (searchParams) {
    const style = resolveStyleGuideLegacyRedirect(path, searchParams);
    if (style) return style;
  }

  let template = WIDE_OS_LEGACY_REDIRECTS[path];
  if (!template && path.startsWith("/client/")) {
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 3) {
      const sub = `/${parts[0]}/__WORKSPACE__/${parts.slice(2).join("/")}`;
      template = WIDE_OS_LEGACY_REDIRECTS[sub];
      if (template) {
        return template.replaceAll("__WORKSPACE__", parts[1]);
      }
    }
  }
  if (!template) return null;
  return template.replaceAll("__WORKSPACE__", workspaceId);
}
