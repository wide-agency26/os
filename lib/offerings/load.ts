import type { CatalogOfferings, OfferingChip, OfferingInput } from "./types";
import { resolveOfferingChips } from "./normalize";

type Sb = any;

export async function loadCatalogOfferings(
  supabase: Sb
): Promise<CatalogOfferings> {
  const [{ data: pkgs }, { data: links }, { data: svcs }] = await Promise.all([
    supabase.from("pm_packages").select("id, name, sort_order").order("sort_order"),
    supabase.from("pm_package_services").select("package_id, service_id"),
    supabase
      .from("pm_services")
      .select("id, name, category, sort_order")
      .order("sort_order"),
  ]);
  const byPkg = new Map<string, string[]>();
  for (const l of links ?? []) {
    const list = byPkg.get(l.package_id) ?? [];
    list.push(l.service_id);
    byPkg.set(l.package_id, list);
  }
  return {
    packages: (pkgs ?? []).map((p: { id: string; name: string; sort_order: number }) => ({
      id: p.id,
      name: p.name,
      serviceIds: byPkg.get(p.id) ?? [],
      sortOrder: p.sort_order ?? 0,
    })),
    services: (svcs ?? []).map(
      (s: { id: string; name: string; category: string; sort_order: number }) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        sortOrder: s.sort_order ?? 0,
      })
    ),
  };
}

type OfferingRow = { kind: string; catalog_id: string };

function rowsToChips(rows: OfferingRow[] | null | undefined, catalog: CatalogOfferings): OfferingChip[] {
  const items: OfferingInput[] = (rows ?? [])
    .filter((r) => r.kind === "package" || r.kind === "service")
    .map((r) => ({
      kind: r.kind as "package" | "service",
      catalogId: r.catalog_id,
    }));
  return resolveOfferingChips(items, catalog);
}

export async function loadOfferingsByProjectIds(
  supabase: Sb,
  projectIds: string[],
  catalog: CatalogOfferings
): Promise<Map<string, OfferingChip[]>> {
  const map = new Map<string, OfferingChip[]>();
  if (projectIds.length === 0) return map;
  const { data } = await supabase
    .from("project_offerings")
    .select("project_id, kind, catalog_id")
    .in("project_id", projectIds);
  const grouped = new Map<string, OfferingRow[]>();
  for (const row of data ?? []) {
    const list = grouped.get(row.project_id) ?? [];
    list.push(row);
    grouped.set(row.project_id, list);
  }
  for (const [id, rows] of grouped) {
    map.set(id, rowsToChips(rows, catalog));
  }
  return map;
}

export async function loadOfferingsByBdIds(
  supabase: Sb,
  bdIds: string[],
  catalog: CatalogOfferings
): Promise<Map<string, OfferingChip[]>> {
  const map = new Map<string, OfferingChip[]>();
  if (bdIds.length === 0) return map;
  const { data } = await supabase
    .from("bd_record_offerings")
    .select("bd_record_id, kind, catalog_id")
    .in("bd_record_id", bdIds);
  const grouped = new Map<string, OfferingRow[]>();
  for (const row of data ?? []) {
    const list = grouped.get(row.bd_record_id) ?? [];
    list.push(row);
    grouped.set(row.bd_record_id, list);
  }
  for (const [id, rows] of grouped) {
    map.set(id, rowsToChips(rows, catalog));
  }
  return map;
}

/** Project offerings win once a project is linked. */
export function pickDealOfferings(
  projectId: string | null | undefined,
  bdId: string | null | undefined,
  byProject: Map<string, OfferingChip[]>,
  byBd: Map<string, OfferingChip[]>
): OfferingChip[] {
  if (projectId && byProject.has(projectId)) return byProject.get(projectId) ?? [];
  if (projectId) {
    const fromProject = byProject.get(projectId);
    if (fromProject && fromProject.length) return fromProject;
  }
  if (bdId) return byBd.get(bdId) ?? [];
  return [];
}
