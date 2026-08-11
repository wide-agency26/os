"use client";

import { useEffect, useState, useTransition } from "react";
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
  Inbox,
  Loader2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { PM_ICONS } from "@/lib/pm/icons";
import {
  PROJECT_FUNNEL_STAGES,
  normalizeProjectStage,
  stagePillarLabel,
  type ProjectAccountingStage,
} from "@/lib/accounting/types";
import { updateProjectAccountingStage } from "@/app/actions/accounting";

const TABS = [
  { name: "Overview", href: (id: string) => `/app/projects/${id}`, icon: LayoutDashboard, exact: true },
  { name: "Tasks", href: (id: string) => `/app/projects/${id}/tasks`, icon: CheckSquare },
  { name: "Timesheet", href: (id: string) => `/app/projects/${id}/timesheet`, icon: Timer },
  { name: "Cost Center", href: (id: string) => `/app/projects/${id}/cost`, icon: PM_ICONS.costCenter },
  { name: "Revenue Center", href: (id: string) => `/app/projects/${id}/revenue`, icon: PM_ICONS.revenueCenter },
  { name: "Review", href: (id: string) => `/app/projects/${id}/review`, icon: Inbox },
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

function funnelValue(
  stage: ProjectAccountingStage
): "prospect" | "lead" | "client" {
  if (stage === "prospect") return "prospect";
  if (stage === "lead") return "lead";
  return "client"; // client | signed | completed
}

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
  const [stage, setStage] = useState<ProjectAccountingStage>("prospect");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("projects")
        .select("stage")
        .eq("id", projectId)
        .maybeSingle();
      if (!cancelled && data?.stage) {
        setStage(normalizeProjectStage(data.stage));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const currentFunnel = funnelValue(stage);
  const pillarLabel = stagePillarLabel(stage);

  const accountingHref =
    pillarLabel === "Identified"
      ? "/app/accounting/identified"
      : pillarLabel === "Unidentified"
        ? "/app/accounting/unidentified"
        : "/app/accounting/actual";

  const onStageChange = (next: "prospect" | "lead" | "client") => {
    if (next === currentFunnel || pending) return;
    setMsg(null);
    const prev = stage;
    setStage(next);
    startTransition(async () => {
      const res = await updateProjectAccountingStage(projectId, next);
      if (!res.ok) {
        setStage(prev);
        setMsg(res.error || "Could not update stage");
        return;
      }
      setMsg(
        `Moved to ${PROJECT_FUNNEL_STAGES.find((s) => s.value === next)?.label} — costs & revenue now on ${stagePillarLabel(next)}.`
      );
    });
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/app/projects/project"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-gray-400 mb-1 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            {clientLabel ? (
              <p className="text-sm text-gray-500 mt-1">{clientLabel}</p>
            ) : null}
          </div>

          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Pipeline
              </span>
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
              ) : null}
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
              {PROJECT_FUNNEL_STAGES.map((s) => {
                const active = currentFunnel === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={pending}
                    title={`${s.label} → ${s.hint}`}
                    onClick={() => onStageChange(s.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-60 ${
                      active
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 text-right">
              Posts to{" "}
              <Link href={accountingHref} className="text-blue-600 hover:underline">
                {pillarLabel}
              </Link>
            </p>
          </div>
        </div>
        {msg ? (
          <p className="mt-2 text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-1.5">
            {msg}
          </p>
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
