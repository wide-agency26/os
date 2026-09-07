function mergeQuery(dest: string, search?: URLSearchParams): string {
  if (!search) return dest;
  const extra = new URLSearchParams();
  search.forEach((value, key) => extra.set(key, value));
  if ([...extra.keys()].length === 0) return dest;
  const url = new URL(dest, "https://wide.local");
  extra.forEach((value, key) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

const WORK_IA_EXACT: Record<string, string> = {
  "/app/bd": "/app/work?view=board",
  "/app/bd/dashboard": "/app/work?view=board",
  "/app/bd/qualification": "/app/work?filter=qualify",
  "/app/bd/lms": "/app/work/sow",
  "/app/bd/lms/new": "/app/work/sow/new",
  "/app/bd/proposal": "/app/work/propose",
  "/app/bd/proposal/slides/new": "/app/work/propose",
  "/app/bd/contract": "/app/work/contract",
  "/app/bd/quotation": "/app/work/quotes",
  "/app/bd/discovery": "/app/tools/find",
  "/app/work/find": "/app/tools/find",
  "/app/projects": "/app/work",
  "/app/projects/ci-builder": "/app/tools/ci",
  "/app/projects/report": "/app/tools/reports",
  "/app/seo-audit": "/app/seo",
  "/app/company-overview": "/app/home",
  "/app/crm/directory": "/app/crm",
  "/app/client-access": "/app/crm/access",
  "/app/crm/users": "/app/crm/access",
};

/** Staff IA: BD / Clients / seo-audit → Work / Tools. */
export function resolveWorkIaRedirect(
  path: string,
  search?: URLSearchParams
): string | null {
  const exact = WORK_IA_EXACT[path];
  if (exact) return mergeQuery(exact, search);

  let m = path.match(/^\/app\/bd\/lms\/([^/]+)\/print\/?$/);
  if (m) return mergeQuery(`/app/work/sow/${m[1]}/print`, search);
  m = path.match(/^\/app\/bd\/lms\/([^/]+)\/?$/);
  if (m) return mergeQuery(`/app/work/sow/${m[1]}`, search);
  m = path.match(/^\/app\/bd\/proposal\/slides\/([^/]+)\/?$/);
  if (m) return mergeQuery(`/app/work/propose`, search);
  m = path.match(/^\/app\/bd\/qualification\/([^/]+)\/?$/);
  if (m) return mergeQuery(`/app/work/qualify/${m[1]}`, search);
  m = path.match(/^\/app\/bd\/contract\/([^/]+)\/?$/);
  if (m) return mergeQuery(`/app/work/contract/${m[1]}`, search);
  m = path.match(/^\/app\/bd\/quotation\/([^/]+)\/?$/);
  if (m) return mergeQuery(`/app/work/quotes/${m[1]}`, search);
  m = path.match(/^\/app\/seo-audit\/([^/]+)\/?$/);
  if (m) return mergeQuery("/app/seo", search);
  m = path.match(/^\/app\/bd\/([^/]+)\/?$/);
  if (m) return mergeQuery(`/app/work/pipeline/${m[1]}`, search);
  return null;
}

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
  "/admin/brand-hub": "/app/tools/ci",
  "/admin/style-guide": "/app/tools/ci",
  "/admin/files": "/app/home",
  "/admin/cm/roster": "/app/crm",
  "/admin/cm/settings": "/app/settings",
  "/admin/clients": "/app/crm",
  "/admin/financials": "/app/accounting",
  "/admin/resources": "/app/hr",
  "/admin/wide-book": "/app/tools/ci",
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
  const workIa = resolveWorkIaRedirect(path, searchParams);
  if (workIa) return workIa;

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
