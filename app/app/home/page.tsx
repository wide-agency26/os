"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { MyWeekClient } from "@/components/pm/MyWeekClient";
import { Users, Briefcase, FileText, ArrowRight, Building2 } from "lucide-react";

function formatEuro(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

type SummaryData = {
  companiesCount: number;
  clientsCount: number;
  activePeopleCount: number;
  openProjectsCount: number;
  openTasksCount: number;
  actualProfit: number | null;
};

function OsSummaryRow() {
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const now = new Date();
      const fyStart = `${now.getFullYear()}-01-01`;
      const fyEnd = `${now.getFullYear()}-12-31`;

      const [
        { data: customers },
        { data: people },
        { data: projects },
        { data: tasks },
        ledgerResult,
      ] = await Promise.all([
        (supabase as any)
          .from("crm_customers")
          .select("id, record_kind, status"),
        (supabase as any)
          .from("people")
          .select("id, roster_status")
          .eq("roster_status", "active"),
        (supabase as any).from("projects").select("id, status"),
        (supabase as any)
          .from("pm_tasks")
          .select("id, status")
          .in("status", ["todo", "in_progress", "blocked"]),
        (supabase as any)
          .from("ledger_entries")
          .select("type, amount, entry_date")
          .eq("pillar", "actual")
          .gte("entry_date", fyStart)
          .lte("entry_date", fyEnd)
          .then(
            (r: any) => r,
            () => ({ data: null, error: true })
          ),
      ]);

      const companiesCount = (customers || []).filter(
        (c: any) => c.record_kind === "company"
      ).length;
      const clientsCount = (customers || []).filter(
        (c: any) => c.status === "Client"
      ).length;
      const openProjectsCount = (projects || []).filter(
        (p: any) => p.status === "running"
      ).length;

      let actualProfit: number | null = null;
      if (ledgerResult && !ledgerResult.error && ledgerResult.data) {
        actualProfit = (ledgerResult.data as any[]).reduce((sum, e) => {
          const amt = Number(e.amount || 0);
          return sum + (e.type === "revenue" ? amt : -amt);
        }, 0);
      }

      setData({
        companiesCount,
        clientsCount,
        activePeopleCount: (people || []).length,
        openProjectsCount,
        openTasksCount: (tasks || []).length,
        actualProfit,
      });
    }
    void load();
  }, []);

  const cards = [
    {
      href: "/app/crm",
      icon: Building2,
      label: "CRM",
      color: "text-indigo-600 bg-indigo-50",
      lines: data
        ? [`${data.companiesCount} companies`, `${data.clientsCount} clients`]
        : ["—"],
    },
    {
      href: "/app/hr",
      icon: Users,
      label: "HR",
      color: "text-green-600 bg-green-50",
      lines: data ? [`${data.activePeopleCount} active people`] : ["—"],
    },
    {
      href: "/app/projects",
      icon: Briefcase,
      label: "Projects",
      color: "text-purple-600 bg-purple-50",
      lines: data
        ? [`${data.openProjectsCount} open projects`, `${data.openTasksCount} open tasks`]
        : ["—"],
    },
    {
      href: "/app/accounting",
      icon: FileText,
      label: "Accounting",
      color: "text-blue-600 bg-blue-50",
      lines: data
        ? data.actualProfit != null
          ? [`${formatEuro(data.actualProfit)} profit (FY)`]
          : ["View ledger"]
        : ["—"],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-3 ${c.color}`}>
              <c.icon size={16} />
            </div>
            <ArrowRight
              size={14}
              className="text-gray-300 group-hover:text-blue-500 transition-colors"
            />
          </div>
          <p className="text-[13px] font-semibold text-gray-900">{c.label}</p>
          <div className="mt-1 space-y-0.5">
            {c.lines.map((line) => (
              <p key={line} className="text-[12px] text-gray-500">
                {line}
              </p>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function HomeWorkspace() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && !isFounder(profile.role)) {
        router.push("/app/client-guidelines");
        return;
      }

      setUserId(user.id);
      setReady(true);
    }
    void checkRole();
  }, [router]);

  if (!ready || !userId) {
    return (
      <Workspace>
        <p className="text-sm text-gray-500">Loading…</p>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <OsSummaryRow />
      <MyWeekClient userId={userId} />
    </Workspace>
  );
}
