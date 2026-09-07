"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ToolProject } from "@/lib/projects/tool-scope";
import { CompanyLogoMark } from "@/components/crm/CompanyLogo";
import {
  partitionByRecents,
  readRecentProjectIds,
  touchRecentProject,
  type ToolRecentKey,
} from "@/lib/tools/recent-projects";
import { sortByLastEdited } from "@/lib/tools/last-edited";

export function ToolProjectPicker({
  eyebrow,
  title,
  subtitle,
  featuredLabel,
  featured,
  all,
  hrefTemplate,
  emptyFeatured,
  tool,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  featuredLabel: string;
  featured: ToolProject[];
  all: ToolProject[];
  /** Serializable path with `{id}` placeholder, e.g. `/app/projects/{id}/ci-builder`. */
  hrefTemplate: string;
  emptyFeatured: string;
  tool: ToolRecentKey;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"featured" | "all">("featured");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentIds(readRecentProjectIds(tool));
  }, [tool]);

  const openProject = (id: string) => {
    touchRecentProject(tool, id);
    setRecentIds(readRecentProjectIds(tool));
    router.push(hrefTemplate.replaceAll("{id}", id));
  };

  const recent = useMemo(() => {
    const { recent: hits } = partitionByRecents(all, (p) => p.id, recentIds);
    return hits;
  }, [all, recentIds]);

  const groups = useMemo(() => {
    const rows = scope === "featured" ? featured : all;
    const recentSet = new Set(recent.map((p) => p.id));
    const rest = sortByLastEdited(rows.filter((p) => !recentSet.has(p.id)));
    const map = new Map<
      string,
      {
        key: string;
        company: string;
        logoUrl: string | null;
        website: string | null;
        lastEditedAt: number;
        projects: ToolProject[];
      }
    >();
    for (const p of rest) {
      const key = p.companyId || p.company;
      const existing = map.get(key);
      if (existing) {
        existing.projects.push(p);
        if (!existing.logoUrl && p.logoUrl) existing.logoUrl = p.logoUrl;
        if (!existing.website && p.website) existing.website = p.website;
        existing.lastEditedAt = Math.max(existing.lastEditedAt, p.lastEditedAt || 0);
      } else {
        map.set(key, {
          key,
          company: p.company,
          logoUrl: p.logoUrl,
          website: p.website,
          lastEditedAt: p.lastEditedAt || 0,
          projects: [p],
        });
      }
    }
    return [...map.values()].sort((a, b) => b.lastEditedAt - a.lastEditedAt);
  }, [scope, featured, all, recent]);

  const ProjectButton = ({ p }: { p: ToolProject }) => (
    <button
      type="button"
      onClick={() => openProject(p.id)}
      className="w-full text-left rounded-lg border border-border bg-surface px-4 py-3 min-h-11 hover:bg-surface-raised"
    >
      <div className="flex items-center gap-3 min-w-0">
        <CompanyLogoMark
          label={p.company}
          logoUrl={p.logoUrl}
          website={p.website}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-text-primary truncate">
            {p.title}
          </div>
          <div className="text-[12px] text-text-muted mt-0.5">
            {p.company}
            {p.live ? " · Live" : " · Not live"}
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {eyebrow}
      </p>
      <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight mt-1">
        {title}
      </h1>
      <p className="text-[13px] text-text-secondary mt-1 mb-4">{subtitle}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          type="button"
          onClick={() => setScope("featured")}
          className={`px-3 py-2 min-h-11 rounded-md text-[12px] font-medium ${
            scope === "featured"
              ? "bg-accent text-white"
              : "border border-border text-text-secondary hover:bg-surface-raised"
          }`}
        >
          {featuredLabel}
          <span className="ml-1 tabular-nums opacity-70">{featured.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`px-3 py-2 min-h-11 rounded-md text-[12px] font-medium ${
            scope === "all"
              ? "bg-accent text-white"
              : "border border-border text-text-secondary hover:bg-surface-raised"
          }`}
        >
          All projects
          <span className="ml-1 tabular-nums opacity-70">{all.length}</span>
        </button>
      </div>

      {recent.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Recent
          </h2>
          <ul className="space-y-2">
            {recent.map((p) => (
              <li key={p.id}>
                <ProjectButton p={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {groups.length === 0 && recent.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-10 text-center">
          <p className="text-[13px] text-text-secondary">{emptyFeatured}</p>
          {scope === "featured" && all.length > 0 ? (
            <button
              type="button"
              onClick={() => setScope("all")}
              className="mt-3 text-[13px] font-medium text-text-primary underline"
            >
              See all projects
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                <CompanyLogoMark
                  label={group.company}
                  logoUrl={group.logoUrl}
                  website={group.website}
                  size={20}
                />
                <span className="truncate">{group.company}</span>
              </h2>
              <ul className="space-y-2">
                {group.projects.map((p) => (
                  <li key={p.id}>
                    <ProjectButton p={p} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
