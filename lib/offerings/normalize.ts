import type {
  CatalogOfferings,
  OfferingChip,
  OfferingInput,
} from "./types";

export function packageServiceIdSet(
  catalog: Pick<CatalogOfferings, "packages">,
  packageId: string | null | undefined
): Set<string> {
  if (!packageId) return new Set();
  const pkg = catalog.packages.find((p) => p.id === packageId);
  return new Set(pkg?.serviceIds ?? []);
}

/** One package max; drop à-la-carte services already included in that package. */
export function normalizeOfferingInputs(
  items: OfferingInput[],
  catalog: Pick<CatalogOfferings, "packages">
): OfferingInput[] {
  const pkg = items.find((i) => i.kind === "package") ?? null;
  const inPkg = packageServiceIdSet(catalog, pkg?.catalogId);
  const seen = new Set<string>();
  const extras: OfferingInput[] = [];
  for (const item of items) {
    if (item.kind !== "service") continue;
    if (inPkg.has(item.catalogId) || seen.has(item.catalogId)) continue;
    seen.add(item.catalogId);
    extras.push({ kind: "service", catalogId: item.catalogId });
  }
  return pkg
    ? [{ kind: "package", catalogId: pkg.catalogId }, ...extras]
    : extras;
}

export function resolveOfferingChips(
  items: OfferingInput[],
  catalog: CatalogOfferings
): OfferingChip[] {
  const normalized = normalizeOfferingInputs(items, catalog);
  const chips: OfferingChip[] = [];
  for (const item of normalized) {
    if (item.kind === "package") {
      const pkg = catalog.packages.find((p) => p.id === item.catalogId);
      if (!pkg) continue;
      chips.push({ kind: "package", catalogId: pkg.id, name: pkg.name });
    } else {
      const svc = catalog.services.find((s) => s.id === item.catalogId);
      if (!svc) continue;
      chips.push({
        kind: "service",
        catalogId: svc.id,
        name: svc.name,
        category: svc.category,
      });
    }
  }
  return chips;
}

/** Human label for bd_records.estimate_service (unidentified ledger). */
export function offeringsEstimateLabel(chips: OfferingChip[]): string | null {
  const pkg = chips.find((c) => c.kind === "package");
  const services = chips.filter((c) => c.kind === "service").map((c) => c.name);
  if (pkg && services.length) return `${pkg.name} · ${services.join(", ")}`;
  if (pkg) return pkg.name;
  if (services.length) return services.join(", ");
  return null;
}
