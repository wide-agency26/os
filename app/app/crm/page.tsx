"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Building2,
  Users,
  Sparkles,
  Handshake,
  DollarSign,
  Briefcase,
  Plus,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type CustomerRow = {
  id: string;
  name: string;
  company: string | null;
  status: string | null;
  lead_status: string | null;
  contract_value: number | null;
  record_kind: "company" | "contact";
  parent_company_id: string | null;
};

type ProjectRow = {
  id: string;
  client_id: string | null;
  status: string | null;
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CrmDashboardPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [{ data: customerRows }, { data: projectRows }] = await Promise.all([
        (supabase as any)
          .from("crm_customers")
          .select(
            "id, name, company, status, lead_status, contract_value, record_kind, parent_company_id"
          )
          .order("name", { ascending: true }),
        (supabase as any).from("projects").select("id, client_id, status"),
      ]);
      setCustomers(customerRows || []);
      setProjects(projectRows || []);
      setLoading(false);
    }
    void load();
  }, []);

  const stats = useMemo(() => {
    const companies = customers.filter((c) => c.record_kind === "company");
    const contacts = customers.filter((c) => c.record_kind === "contact");
    const prospects = customers.filter((c) => c.status === "Prospect");
    const clients = customers.filter((c) => c.status === "Client");
    const pipelineValue = customers.reduce((sum, c) => {
      const notWonClient = c.status === "Client" && c.lead_status === "Won";
      if (notWonClient) return sum;
      return sum + Number(c.contract_value || 0);
    }, 0);
    const companyIds = new Set(companies.map((c) => c.id));
    const activeProjects = projects.filter(
      (p) => p.status === "running" && p.client_id && companyIds.has(p.client_id)
    );
    const activeProjectsAll = projects.filter((p) => p.status === "running");

    return {
      companiesCount: companies.length,
      contactsCount: contacts.length,
      prospectsCount: prospects.length,
      clientsCount: clients.length,
      pipelineValue,
      activeProjectsCount: activeProjectsAll.length,
      companies,
    };
  }, [customers, projects]);

  const companyCards = useMemo(() => {
    return stats.companies
      .map((company) => {
        const contactsCount = customers.filter(
          (c) => c.record_kind === "contact" && c.parent_company_id === company.id
        ).length;
        const projectsCount = projects.filter((p) => p.client_id === company.id).length;
        return { ...company, contactsCount, projectsCount };
      })
      .sort((a, b) => b.projectsCount - a.projectsCount || a.name.localeCompare(b.name));
  }, [stats.companies, customers, projects]);

  const pipelineStrip = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const c of customers) {
      const key = c.status === "Client" ? "Client" : c.lead_status || "Reached out";
      buckets[key] = (buckets[key] || 0) + 1;
    }
    const order = [
      "Reached out",
      "Proposal Sent",
      "On-hold",
      "Won",
      "Client",
      "Lost",
    ];
    return order
      .filter((key) => buckets[key])
      .map((key) => ({ key, count: buckets[key] }))
      .concat(
        Object.keys(buckets)
          .filter((k) => !order.includes(k))
          .map((key) => ({ key, count: buckets[key] }))
      );
  }, [customers]);

  const scorecards = [
    {
      label: "Companies",
      value: stats.companiesCount,
      icon: Building2,
      color: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Contacts",
      value: stats.contactsCount,
      icon: Users,
      color: "text-slate-600 bg-slate-50",
    },
    {
      label: "Prospects",
      value: stats.prospectsCount,
      icon: Sparkles,
      color: "text-orange-600 bg-orange-50",
    },
    {
      label: "Clients",
      value: stats.clientsCount,
      icon: Handshake,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Pipeline value",
      value: formatMoney(stats.pipelineValue),
      icon: DollarSign,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Active projects",
      value: stats.activeProjectsCount,
      icon: Briefcase,
      color: "text-purple-600 bg-purple-50",
    },
  ];

  return (
    <Workspace wide>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CRM</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Companies, contacts, and pipeline at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/projects"
            className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Briefcase size={16} />
            Projects
          </Link>
          <Link
            href="/app/crm/directory"
            className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Directory
          </Link>
          <Link
            href="/app/crm/new"
            className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            New
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {scorecards.map((s) => (
          <div
            key={s.label}
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <div
              className={`w-8 h-8 rounded-md flex items-center justify-center mb-3 ${s.color}`}
            >
              <s.icon size={16} />
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums">
              {loading ? "—" : s.value}
            </div>
            <div className="text-[12px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {pipelineStrip.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[13px] font-bold text-gray-900 mb-3">Pipeline</h3>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {pipelineStrip.map((p) => (
              <div
                key={p.key}
                className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-3 py-2.5 bg-white"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {p.key}
                </div>
                <div className="text-lg font-bold text-gray-900 tabular-nums">
                  {p.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-gray-900">Companies</h3>
        <Link
          href="/app/crm/directory"
          className="text-[12px] text-blue-600 hover:underline flex items-center gap-1"
        >
          View directory
          <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="p-10 text-center text-[13px] text-gray-500 border border-gray-200 rounded-lg">
          Loading companies…
        </div>
      ) : companyCards.length === 0 ? (
        <div className="p-10 text-center space-y-3 border border-dashed border-gray-300 rounded-lg">
          <Building2 className="mx-auto text-gray-300" size={32} />
          <p className="text-[14px] font-medium text-gray-800">No companies yet</p>
          <p className="text-[13px] text-gray-500 max-w-sm mx-auto">
            Create a company record to start tracking contacts and projects under it.
          </p>
          <Link
            href="/app/crm/new"
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium"
          >
            <Plus size={14} />
            New company
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {companyCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => router.push(`/app/crm/${c.id}`)}
              className="text-left border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {c.company || c.name}
                  </p>
                  <span
                    className={`inline-flex mt-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                      c.status === "Client"
                        ? "bg-green-100 text-green-700"
                        : c.status === "Lead"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {c.status || "Prospect"}
                  </span>
                </div>
                <ArrowUpRight
                  size={16}
                  className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0"
                />
              </div>
              <div className="flex items-center gap-4 mt-3 text-[12px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {c.contactsCount} contact{c.contactsCount === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase size={12} />
                  {c.projectsCount} project{c.projectsCount === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Workspace>
  );
}
