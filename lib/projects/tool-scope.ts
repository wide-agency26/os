/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  loadLastEditedByProject,
  stampLastEdited,
} from "@/lib/tools/last-edited";
import { ts, type ToolRecentKey } from "@/lib/tools/recent-projects";

export const BLOG_TOOL_SERVICES = ["SEO"] as const;
export const CONTENT_TOOL_SERVICES = ["Social Media Content"] as const;

export type ToolProject = {
  id: string;
  title: string;
  company: string;
  companyId: string;
  logoUrl: string | null;
  website: string | null;
  live: boolean;
  services: string[];
  lastEditedAt?: number;
};

function asRecord(value: any): any {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function companyInfo(row: any): {
  companyId: string;
  company: string;
  logoUrl: string | null;
  website: string | null;
} {
  const client = asRecord(row.crm_customers);
  const parent = asRecord(client?.parent);
  const companyRow =
    client?.record_kind === "contact" && parent ? parent : client;
  return {
    companyId: String(companyRow?.id || client?.id || ""),
    company:
      companyRow?.company ||
      companyRow?.name ||
      client?.company ||
      client?.name ||
      "No company",
    logoUrl: companyRow?.logo_url || client?.logo_url || null,
    website: companyRow?.website || client?.website || null,
  };
}

function isLive(row: { status?: string | null; contract_confirmed_at?: string | null }) {
  return row.status === "running" && Boolean(row.contract_confirmed_at);
}

function add(map: Map<string, Set<string>>, projectId: string, names: string[]) {
  if (!projectId || !names.length) return;
  const set = map.get(projectId) ?? new Set<string>();
  for (const n of names) if (n) set.add(n);
  map.set(projectId, set);
}

function packageFromTitle(title: string, packageNames: string[]): string | null {
  const hay = title.toLowerCase();
  const ranked = [...packageNames].sort((a, b) => b.length - a.length);
  for (const name of ranked) {
    if (hay.includes(name.toLowerCase())) return name;
  }
  return null;
}

function servicesFromTitle(title: string, catalog: string[]): string[] {
  const hay = title.toLowerCase();
  return catalog.filter((s) => {
    if (s === "SEO") return /\bseo\b/.test(hay);
    if (s === "Social Media Content") return /social media|content calendar/.test(hay);
    return hay.includes(s.toLowerCase());
  });
}

/**
 * Live projects that actually include a service (SOW lines, package, or title).
 * Default lists for Blog Builder / Content calendar use this so MVB-only work
 * does not clog the picker.
 */
export async function loadToolProjects(
  supabase: any,
  needed: readonly string[],
  activity?: ToolRecentKey
): Promise<{ featured: ToolProject[]; all: ToolProject[] }> {
  const [{ data: projectRows }, { data: packageRows }, { data: packageServices }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, title, status, contract_confirmed_at, sow_family_id, updated_at, crm_customers:client_id ( id, record_kind, parent_company_id, company, name, logo_url, website, parent:parent_company_id ( id, company, name, logo_url, website ) )"
      )
      .order("updated_at", { ascending: false }),
    supabase.from("pm_packages").select("id, name"),
    supabase.from("pm_package_services").select("package_id, pm_services:service_id ( name )"),
  ]);

  const packages = (packageRows || []) as { id: string; name: string }[];
  const packageNames = packages.map((p) => p.name);
  const servicesByPackageId = new Map<string, string[]>();
  const servicesByPackageName = new Map<string, string[]>();
  for (const row of packageServices || []) {
    const svc = Array.isArray(row.pm_services) ? row.pm_services[0] : row.pm_services;
    const name = svc?.name as string | undefined;
    if (!name) continue;
    const pid = row.package_id as string;
    servicesByPackageId.set(pid, [...(servicesByPackageId.get(pid) || []), name]);
  }
  for (const pkg of packages) {
    servicesByPackageName.set(pkg.name, servicesByPackageId.get(pkg.id) || []);
  }

  const projects = (projectRows || []) as any[];
  const ids = projects.map((p) => p.id as string);
  const familyIds = projects.map((p) => p.sow_family_id).filter(Boolean) as string[];

  const serviceMap = new Map<string, Set<string>>();

  if (ids.length) {
    const sowSelect =
      "id, project_id, package_id, sow_line_items ( pm_services:service_id ( name ) )";
    const [{ data: sowsByProject }, { data: sowsByFamily }] = await Promise.all([
      supabase.from("sows").select(sowSelect).in("project_id", ids),
      familyIds.length
        ? supabase.from("sows").select(sowSelect).in("id", familyIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const sowById = new Map<string, any>();
    for (const sow of [...(sowsByProject || []), ...(sowsByFamily || [])]) {
      sowById.set(sow.id, sow);
      const fromPkg = sow.package_id ? servicesByPackageId.get(sow.package_id) || [] : [];
      const fromLines = ((sow.sow_line_items || []) as any[])
        .map((li) => {
          const s = Array.isArray(li.pm_services) ? li.pm_services[0] : li.pm_services;
          return s?.name as string | undefined;
        })
        .filter(Boolean) as string[];
      if (sow.project_id) add(serviceMap, sow.project_id, [...fromPkg, ...fromLines]);
    }

    for (const p of projects) {
      if (p.sow_family_id && sowById.has(p.sow_family_id)) {
        const sow = sowById.get(p.sow_family_id);
        const fromPkg = sow.package_id ? servicesByPackageId.get(sow.package_id) || [] : [];
        const fromLines = ((sow.sow_line_items || []) as any[])
          .map((li: any) => {
            const s = Array.isArray(li.pm_services) ? li.pm_services[0] : li.pm_services;
            return s?.name as string | undefined;
          })
          .filter(Boolean) as string[];
        add(serviceMap, p.id, [...fromPkg, ...fromLines]);
      }
    }
  }

  const all: ToolProject[] = projects.map((p) => {
    const services = new Set(serviceMap.get(p.id) || []);
    const pkgName = packageFromTitle(p.title || "", packageNames);
    if (pkgName) for (const s of servicesByPackageName.get(pkgName) || []) services.add(s);
    for (const s of servicesFromTitle(p.title || "", [
      "SEO",
      "Social Media Content",
      "Paid Ads",
      "Website Development",
      "Website Design",
    ])) {
      services.add(s);
    }
    return {
      id: p.id,
      title: p.title,
      ...companyInfo(p),
      live: isLive(p),
      services: [...services],
      lastEditedAt: ts(p.updated_at),
    };
  });

  const stamped = activity
    ? stampLastEdited(all, await loadLastEditedByProject(supabase, activity))
    : all;

  const featured = stamped.filter(
    (p) => p.live && needed.some((s) => p.services.includes(s))
  );

  return { featured, all: stamped };
}
