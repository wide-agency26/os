"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Database, type LucideIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  partitionByRecents,
  readRecentProjectIds,
  ts,
  touchRecentProject,
} from "@/lib/tools/recent-projects";

export interface ReportsProjectOption {
  id: string;
  title: string;
  company?: string;
  lastEditedAt?: number;
}

export function reportsProjectLabel(p: ReportsProjectOption) {
  return p.company ? `${p.company} — ${p.title}` : p.title;
}

const TABS: {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
}[] = [
  {
    id: "report",
    label: "Report",
    href: "/app/tools/reports",
    icon: BarChart3,
    hint: "Dashboards & publish",
  },
  {
    id: "sources",
    label: "Sources",
    href: "/app/projects/report-data",
    icon: Database,
    hint: "Connect or upload",
  },
];

interface ReportsHubShellProps {
  projects: ReportsProjectOption[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  isAdmin?: boolean;
  children?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function ReportsHubShell({
  projects,
  selectedProjectId,
  onProjectChange,
  isAdmin = true,
  children,
  trailing,
}: ReportsHubShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [editedAt, setEditedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    setRecentIds(readRecentProjectIds("reports"));
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      touchRecentProject("reports", selectedProjectId);
      setRecentIds(readRecentProjectIds("reports"));
    }
  }, [selectedProjectId]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data } = await (supabase as any)
        .from("datasets")
        .select("project_id, updated_at, synced_at, created_at");
      const map: Record<string, number> = {};
      for (const row of data || []) {
        const t = Math.max(
          ts(row.updated_at),
          ts(row.synced_at),
          ts(row.created_at)
        );
        if (!row.project_id || !t) continue;
        if (t > (map[row.project_id] || 0)) map[row.project_id] = t;
      }
      setEditedAt(map);
    })();
  }, []);

  const { recent, rest } = useMemo(() => {
    const stamped = projects.map((p) => ({
      ...p,
      lastEditedAt: Math.max(p.lastEditedAt || 0, editedAt[p.id] || 0),
    }));
    const split = partitionByRecents(stamped, (p) => p.id, recentIds);
    return {
      recent: split.recent,
      rest: [...split.rest].sort(
        (a, b) => (b.lastEditedAt || 0) - (a.lastEditedAt || 0)
      ),
    };
  }, [projects, recentIds, editedAt]);

  const withProject = (href: string) => {
    if (!selectedProjectId) return href;
    const sp = new URLSearchParams();
    sp.set("project", selectedProjectId);
    return `${href}?${sp.toString()}`;
  };

  const selectProject = (id: string) => {
    touchRecentProject("reports", id);
    setRecentIds(readRecentProjectIds("reports"));
    onProjectChange(id);
    const sp = new URLSearchParams(searchParams?.toString() || "");
    if (id) sp.set("project", id);
    else sp.delete("project");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  return (
    <div className="space-y-4 mb-4">
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => selectProject(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-[13px] bg-surface text-text-primary focus:ring-1 focus:ring-accent focus:border-accent outline-none"
            >
              {projects.length === 0 && <option value="">No projects found…</option>}
              {recent.length > 0 && (
                <optgroup label="Recent">
                  {recent.map((p) => (
                    <option key={`recent-${p.id}`} value={p.id}>
                      {reportsProjectLabel(p)}
                    </option>
                  ))}
                </optgroup>
              )}
              {rest.length > 0 && (
                <optgroup label={recent.length ? "All projects" : "Projects"}>
                  {rest.map((p) => (
                    <option key={p.id} value={p.id}>
                      {reportsProjectLabel(p)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          {trailing}
        </div>

        {isAdmin && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {TABS.map((p) => {
              const Icon = p.icon;
              const active =
                p.href === "/app/tools/reports"
                  ? pathname === "/app/tools/reports" || pathname === "/app/projects/report"
                  : pathname === p.href || pathname?.startsWith(p.href);
              return (
                <Link
                  key={p.id}
                  href={withProject(p.href)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                    active
                      ? "bg-accent text-white border-accent"
                      : "bg-surface text-text-secondary border-border hover:border-text-muted hover:text-text-primary"
                  }`}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  <span>{p.label}</span>
                  <span
                    className={`hidden sm:inline text-[10px] font-normal ${
                      active ? "text-white/70" : "text-text-muted"
                    }`}
                  >
                    {p.hint}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
