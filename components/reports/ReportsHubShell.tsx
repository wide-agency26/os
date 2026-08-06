"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Database,
  Filter,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface ReportsProjectOption {
  id: string;
  title: string;
  company?: string;
}

export function reportsProjectLabel(p: ReportsProjectOption) {
  return p.company ? `${p.company} — ${p.title}` : p.title;
}

const PILLARS: {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
}[] = [
  {
    id: "report",
    label: "Report Viewer",
    href: "/app/projects/report",
    icon: BarChart3,
    hint: "Live dashboards",
  },
  {
    id: "data",
    label: "Data Hub",
    href: "/app/projects/report-data",
    icon: Database,
    hint: "CSV / Excel uploads",
  },
  {
    id: "funnel",
    label: "Funnel Config",
    href: "/app/projects/funnel",
    icon: Filter,
    hint: "Stage metric mapping",
  },
  {
    id: "insights",
    label: "AI Insight Center",
    href: "/app/projects/insights",
    icon: Sparkles,
    hint: "Strategic commentary",
  },
];

interface ReportsHubShellProps {
  projects: ReportsProjectOption[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  isAdmin?: boolean;
  children?: React.ReactNode;
  /** Extra controls beside the project picker */
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

  const withProject = (href: string) => {
    if (!selectedProjectId) return href;
    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.set("project", selectedProjectId);
    return `${href}?${sp.toString()}`;
  };

  return (
    <div className="space-y-4 mb-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                const id = e.target.value;
                onProjectChange(id);
                const sp = new URLSearchParams(searchParams?.toString() || "");
                if (id) sp.set("project", id);
                else sp.delete("project");
                const q = sp.toString();
                router.replace(q ? `${pathname}?${q}` : pathname);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              {projects.length === 0 && <option value="">No projects found…</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {reportsProjectLabel(p)}
                </option>
              ))}
            </select>
          </div>
          {trailing}
        </div>

        {isAdmin && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              const active =
                pathname === p.href ||
                (p.href !== "/app/projects/report" && pathname?.startsWith(p.href));
              return (
                <Link
                  key={p.id}
                  href={withProject(p.href)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-colors ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                  }`}
                >
                  <Icon size={15} />
                  <span>{p.label}</span>
                  <span
                    className={`hidden sm:inline text-[10px] font-normal ${
                      active ? "text-indigo-100" : "text-gray-400"
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
