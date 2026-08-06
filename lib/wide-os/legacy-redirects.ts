/**
 * Canonical path migrations from earlier portal iterations.
 */
export const WIDE_OS_LEGACY_REDIRECTS: Record<string, string> = {
  "/admin": "/app/home",
  "/admin/dashboard": "/app/home",
  "/admin/work": "/app/home",
  "/admin/cockpit": "/app/home",
  "/admin/bd/dashboard": "/app/home",
  "/admin/bd/prospects": "/app/home",
  "/admin/bd/partnerships": "/app/home",
  "/admin/bd/pipeline": "/app/home",
  "/admin/bd/marketing": "/app/home",
  "/admin/bd/tasks": "/app/home",
  "/bd/dashboard": "/app/home",
  "/bd/prospects": "/app/home",
  "/bd/partnerships": "/app/home",
  "/bd/pipeline": "/app/home",
  "/bd/marketing": "/app/home",
  "/bd/tasks": "/app/home",
  "/admin/hr/dashboard": "/app/hr",
  "/admin/hr/directory": "/app/hr",
  "/hr/dashboard": "/app/hr",
  "/hr/directory": "/app/hr",
  "/admin/people": "/app/hr",
  "/dashboard": "/app/home",
  "/brand-hub": "/app/client-guidelines",
  "/style-guide": "/app/client-guidelines",
  "/files": "/app/client-files",
  "/settings": "/app/settings",
  "/cm/dashboard": "/app/crm",
  "/cm/roster": "/app/crm",
  "/client/__WORKSPACE__/strategy": "/app/client-guidelines",
  "/client/__WORKSPACE__/guidelines": "/app/client-guidelines",
  "/client/__WORKSPACE__/assets": "/app/client-files",
  "/client/__WORKSPACE__/creative": "/app/client-guidelines",
  "/client/__WORKSPACE__/webstyleguide": "/app/client-guidelines",
  "/client/__WORKSPACE__/brandguideline": "/app/client-guidelines",
  "/admin/brand-hub": "/app/projects/ci-builder",
  "/admin/style-guide": "/app/projects/ci-builder",
  "/admin/files": "/app/home",
  "/admin/cm/roster": "/app/crm",
  "/admin/cm/settings": "/app/settings",
  "/admin/clients": "/app/crm",
  "/admin/financials": "/app/accounting",
  "/admin/resources": "/app/hr",
  "/admin/wide-book": "/app/projects/ci-builder",
};

/** /admin/style-guide?client=<uuid> → client guidelines library */
export function resolveStyleGuideLegacyRedirect(
  path: string,
  searchParams: URLSearchParams
): string | null {
  if (path !== "/admin/style-guide") return null;
  const client = searchParams.get("client");
  if (client && /^[0-9a-f-]{36}$/i.test(client)) {
    return "/app/client-guidelines";
  }
  return WIDE_OS_LEGACY_REDIRECTS[path] ?? null;
}

/** /admin/brand-hub/<uuid> → client guidelines */
export function resolveBrandHubLegacyRedirect(path: string): string | null {
  const m = path.match(/^\/admin\/brand-hub\/([0-9a-f-]{36})\/?$/i);
  if (m) return "/app/client-guidelines";
  const clientM = path.match(/^\/admin\/clients\/([0-9a-f-]{36})\/?$/i);
  if (clientM) return "/app/crm";
  const cmM = path.match(/^\/admin\/cm\/([0-9a-f-]{36})\/(dashboard|brandguideline|webstyleguide|files|settings)\/?$/i);
  if (cmM) {
    const seg = cmM[2];
    if (seg === "files") return "/app/client-files";
    if (seg === "settings") return "/app/settings";
    return "/app/client-guidelines";
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
