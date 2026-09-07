"use client";

import { Merge, Plus, Unlink } from "lucide-react";
import type { SowDocument, SowSection, PmService } from "@/lib/sow/types";
import { CATEGORY_LABELS, SOW_CATEGORY_ORDER, formatSowMoney } from "@/lib/sow/constants";

export function scopePrice(sow: SowDocument, section: SowSection): number | null {
  const grouped = sow.cost_groups.filter((g) =>
    section.line_items.some((i) => i.cost_group_id === g.id)
  );
  if (grouped.length === 1) {
    const gid = grouped[0].id;
    if (section.line_items.every((i) => i.cost_group_id === gid)) {
      return grouped[0].price;
    }
  }
  const sum = section.line_items.reduce((acc, i) => {
    if (i.cost_group_id) return acc;
    return acc + (i.price ?? 0);
  }, 0);
  return sum > 0 ? sum : null;
}

export function ScopeList({
  sow,
  services,
  packages = [],
  selectedIds,
  activeId,
  mergeTitle,
  mergePrice,
  pending,
  onSelectActive,
  onToggleSelect,
  onMergeTitle,
  onMergePrice,
  onMerge,
  onUnmerge,
  onAddService,
  onAddPackage,
  onAddBlank,
}: {
  sow: SowDocument;
  services: PmService[];
  packages?: { id: string; name: string }[];
  selectedIds: Set<string>;
  activeId: string | "hero";
  mergeTitle: string;
  mergePrice: string;
  pending: boolean;
  onSelectActive: (id: string | "hero") => void;
  onToggleSelect: (id: string) => void;
  onMergeTitle: (v: string) => void;
  onMergePrice: (v: string) => void;
  onMerge: () => void;
  onUnmerge: (sectionId: string) => void;
  onAddService: (serviceId: string) => void;
  onAddPackage?: (packageId: string) => void;
  onAddBlank: () => void;
}) {
  const used = new Set(sow.sections.map((s) => s.service_id).filter(Boolean));
  const available = services.filter((s) => !used.has(s.id));

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
      <div className="px-3 py-2 border-b border-gray-200">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          Scopes
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          Select whole services to merge — not sub-items.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <button
          type="button"
          onClick={() => onSelectActive("hero")}
          className={`w-full text-left rounded-lg border px-3 py-2 ${
            activeId === "hero"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p className="text-sm font-semibold">Hero & tone</p>
          <p className={`text-[11px] ${activeId === "hero" ? "text-white/70" : "text-gray-500"}`}>
            Intro + conservative block
          </p>
        </button>
        {sow.sections.map((section) => {
          const price = scopePrice(sow, section);
          const merged = Boolean(section.merge_origin && section.merge_origin.length > 1);
          const checked = selectedIds.has(section.id);
          const active = activeId === section.id;
          return (
            <div
              key={section.id}
              className={`rounded-lg border px-3 py-2 ${
                active ? "border-gray-900 bg-white ring-1 ring-gray-900" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={pending}
                  onChange={() => onToggleSelect(section.id)}
                />
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onSelectActive(section.id)}
                >
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {section.title}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {section.line_items.length} deliverable
                    {section.line_items.length === 1 ? "" : "s"}
                    {merged ? " · merged" : ""}
                  </p>
                  <p className="text-xs font-medium text-gray-800 mt-1">
                    {price != null
                      ? formatSowMoney(price, sow.currency)
                      : "Unpriced"}
                  </p>
                </button>
              </div>
              {merged && (
                <button
                  type="button"
                  disabled={pending}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                  onClick={() => onUnmerge(section.id)}
                >
                  <Unlink size={11} /> Unmerge scopes
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedIds.size >= 2 && (
        <div className="border-t border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
            Merge {selectedIds.size} scopes
          </p>
          <input
            className="w-full rounded-md border border-amber-200 px-2 py-1.5 text-xs bg-white"
            value={mergeTitle}
            onChange={(e) => onMergeTitle(e.target.value)}
            placeholder="Combined title"
          />
          <input
            type="number"
            className="w-full rounded-md border border-amber-200 px-2 py-1.5 text-xs bg-white"
            value={mergePrice}
            onChange={(e) => onMergePrice(e.target.value)}
            placeholder="One price"
          />
          <button
            type="button"
            disabled={pending}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold py-2 disabled:opacity-50"
            onClick={onMerge}
          >
            <Merge size={13} /> Merge into one scope
          </button>
        </div>
      )}

      <div className="border-t border-gray-200 p-3 space-y-3">
        {packages.length > 0 && onAddPackage ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-gray-600">Add catalog package</p>
            <p className="text-[10px] text-gray-400">
              Expands the package into its services (skips ones already on this SOW).
            </p>
            <div className="flex flex-wrap gap-1.5">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  disabled={pending}
                  onClick={() => onAddPackage(pkg.id)}
                  className="rounded-md border border-gray-900 bg-gray-900 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-40"
                >
                  {pkg.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-600">Add catalog service</p>
          {SOW_CATEGORY_ORDER.map((cat) => {
            const list = available.filter((s) => s.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat} className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={pending}
                      onClick={() => onAddService(s.id)}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-800 hover:border-gray-400 disabled:opacity-40"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {available.length === 0 ? (
            <p className="text-[11px] text-gray-400">All catalog services are already in this SOW.</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={pending}
          className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 text-xs font-medium py-1.5 hover:bg-gray-50"
          onClick={onAddBlank}
        >
          <Plus size={12} /> Blank section
        </button>
      </div>
    </div>
  );
}
