"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORY_LABELS, SOW_CATEGORY_ORDER } from "@/lib/sow/constants";
import type { SowCategory } from "@/lib/sow/types";
import {
  normalizeOfferingInputs,
  packageServiceIdSet,
} from "@/lib/offerings/normalize";
import type {
  CatalogOfferings,
  OfferingChip,
  OfferingInput,
} from "@/lib/offerings/types";

let catalogCache: CatalogOfferings | null = null;

export function useCatalogOfferings() {
  const [catalog, setCatalog] = useState<CatalogOfferings | null>(catalogCache);
  useEffect(() => {
    if (catalogCache) {
      setCatalog(catalogCache);
      return;
    }
    void fetch("/api/offerings/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((res: { ok?: boolean; catalog?: CatalogOfferings }) => {
        if (res.ok && res.catalog) {
          catalogCache = res.catalog;
          setCatalog(res.catalog);
        }
      });
  }, []);
  return catalog;
}

export function OfferingPicker({
  value,
  onChange,
  catalog: catalogProp,
}: {
  value: OfferingChip[] | OfferingInput[];
  onChange: (next: OfferingInput[]) => void;
  catalog?: CatalogOfferings | null;
}) {
  const loaded = useCatalogOfferings();
  const catalog = catalogProp ?? loaded;
  const [query, setQuery] = useState("");

  const items = useMemo<OfferingInput[]>(
    () =>
      catalog
        ? normalizeOfferingInputs(
            value.map((v) => ({ kind: v.kind, catalogId: v.catalogId })),
            catalog
          )
        : value.map((v) => ({ kind: v.kind, catalogId: v.catalogId })),
    [value, catalog]
  );

  const selectedPkg = items.find((i) => i.kind === "package")?.catalogId ?? null;
  const extraIds = new Set(
    items.filter((i) => i.kind === "service").map((i) => i.catalogId)
  );
  const inPkg = catalog ? packageServiceIdSet(catalog, selectedPkg) : new Set<string>();

  const q = query.trim().toLowerCase();
  const packages = (catalog?.packages ?? []).filter(
    (p) => !q || p.name.toLowerCase().includes(q)
  );
  const services = (catalog?.services ?? []).filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q)
  );

  const groups = useMemo(() => {
    const out: { category: SowCategory; items: CatalogOfferings["services"] }[] = [];
    for (const cat of SOW_CATEGORY_ORDER) {
      const list = services.filter((s) => s.category === cat);
      if (list.length) out.push({ category: cat, items: list });
    }
    const leftover = services.filter(
      (s) => !SOW_CATEGORY_ORDER.includes(s.category as SowCategory)
    );
    if (leftover.length) out.push({ category: "custom", items: leftover });
    return out;
  }, [services]);

  function emit(next: OfferingInput[]) {
    onChange(catalog ? normalizeOfferingInputs(next, catalog) : next);
  }

  function togglePackage(id: string) {
    if (selectedPkg === id) {
      emit(items.filter((i) => i.kind !== "package"));
      return;
    }
    emit([
      { kind: "package", catalogId: id },
      ...items.filter((i) => i.kind === "service"),
    ]);
  }

  function toggleService(id: string) {
    if (inPkg.has(id)) return;
    if (extraIds.has(id)) {
      emit(items.filter((i) => !(i.kind === "service" && i.catalogId === id)));
      return;
    }
    emit([...items, { kind: "service", catalogId: id }]);
  }

  if (!catalog) {
    return (
      <p className="text-[12px] text-text-muted px-1 py-2">Loading catalog…</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search packages and services…"
          className="w-full rounded-md border border-border bg-surface pl-8 pr-3 py-2 text-[13px] text-text-primary outline-none focus:border-text-muted"
        />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
          Package
        </p>
        <div className="grid gap-1.5">
          {packages.map((p) => {
            const on = selectedPkg === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePackage(p.id)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  on
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface hover:border-text-muted"
                }`}
              >
                <p className="text-[13px] font-semibold">{p.name}</p>
                <p className={`text-[11px] mt-0.5 ${on ? "text-white/70" : "text-text-muted"}`}>
                  {p.serviceIds.length} service{p.serviceIds.length === 1 ? "" : "s"}
                </p>
              </button>
            );
          })}
          {packages.length === 0 ? (
            <p className="text-[12px] text-text-muted">No packages match.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Services
          {selectedPkg ? (
            <span className="font-medium normal-case tracking-normal text-text-secondary">
              {" "}
              — extras beyond the package
            </span>
          ) : null}
        </p>
        {groups.map((group) => (
          <div key={group.category} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
              {CATEGORY_LABELS[group.category] || group.category}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((s) => {
                const included = inPkg.has(s.id);
                const extra = extraIds.has(s.id);
                const on = included || extra;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={included}
                    onClick={() => toggleService(s.id)}
                    title={included ? "Included in the selected package" : undefined}
                    className={`rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                      included
                        ? "border-border bg-surface-raised text-text-muted cursor-default"
                        : extra
                          ? "border-accent bg-accent text-white"
                          : "border-border bg-surface text-text-primary hover:border-text-muted"
                    }`}
                  >
                    {s.name}
                    {included ? (
                      <span className="ml-1 text-[10px] font-normal opacity-70">in pkg</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 ? (
          <p className="text-[12px] text-text-muted">No services match.</p>
        ) : null}
      </div>
    </div>
  );
}
