"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Timer,
  Palette,
  BarChart3,
  ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import { PM_ICONS } from "@/lib/pm/icons";

const TABS = [
  { name: "Overview", href: (id: string) => `/app/projects/${id}`, icon: LayoutDashboard, exact: true },
  { name: "Tasks", href: (id: string) => `/app/projects/${id}/tasks`, icon: CheckSquare },
  { name: "Timesheet", href: (id: string) => `/app/projects/${id}/timesheet`, icon: Timer },
  { name: "Cost Center", href: (id: string) => `/app/projects/${id}/cost`, icon: PM_ICONS.costCenter },
  {
    name: "CI Builder",
    href: (id: string) => `/app/projects/${id}/ci-builder`,
    icon: Palette,
    external: true,
  },
  {
    name: "Reports",
    href: (_id: string) => `/app/projects/report`,
    icon: BarChart3,
    external: true,
  },
] as const;

export function ProjectPmShell({
  projectId,
  title,
  clientLabel,
  children,
}: {
  projectId: string;
  title: string;
  clientLabel?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/app/projects/project"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-gray-400 mb-1 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Projects
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {clientLabel ? (
          <p className="text-sm text-gray-500 mt-1">{clientLabel}</p>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => {
          const href = tab.href(projectId);
          const isExternal = "external" in tab && tab.external;
          const active = isExternal
            ? false
            : "exact" in tab && tab.exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.name}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? "border-gray-900 text-gray-900 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.name}
              {isExternal ? (
                <ArrowUpRight className="w-3 h-3 opacity-70" aria-hidden />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
