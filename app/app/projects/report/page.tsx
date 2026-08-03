"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { BarChart3, Users, ArrowRight, Search, Loader2 } from "lucide-react";

interface ClientEntry {
  id: string;
  full_name: string;
  company_name: string | null;
  role: string;
  hasReport: boolean;
  packageTier: string | null;
}

/**
 * Report Hub — Landing page that lists all clients and links to their
 * Admin Builder or Client Viewer pages.
 */
export default function ReportHubPage() {
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchClients() {
      const supabase = createClient();

      // Fetch all client profiles
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, company_name, role")
        .eq("role", "client")
        .order("full_name");

      // Fetch existing report configurations
      const { data: configs } = await (supabase as any)
        .from("report_configurations")
        .select("client_id, package_tier, is_active")
        .eq("is_active", true);

      const configMap = new Map<string, string>();
      (configs || []).forEach((c: any) => {
        configMap.set(c.client_id, c.package_tier);
      });

      const merged: ClientEntry[] = (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || "Unknown",
        company_name: p.company_name,
        role: p.role,
        hasReport: configMap.has(p.id),
        packageTier: configMap.get(p.id) || null,
      }));

      setClients(merged);
      setLoading(false);
    }

    fetchClients();
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.company_name || "").toLowerCase().includes(q)
    );
  });

  const tierBadge = (tier: string | null) => {
    if (!tier) return null;
    const labels: Record<string, { label: string; color: string }> = {
      mvb: { label: "MVB", color: "bg-gray-100 text-gray-600" },
      launch: { label: "Launch", color: "bg-blue-100 text-blue-700" },
      growth: { label: "Growth", color: "bg-purple-100 text-purple-700" },
      full_partnership: { label: "Full Partner", color: "bg-amber-100 text-amber-800" },
    };
    const b = labels[tier] || labels.launch;
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.color}`}>
        {b.label}
      </span>
    );
  };

  return (
    <Workspace>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Report Center</h2>
            <p className="text-gray-500 text-[13px]">
              Provision and manage client performance dashboards.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Client Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading clients…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Users size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-[13px]">
            {search ? "No clients match your search." : "No client profiles found."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-[14px]">
                    {client.company_name || client.full_name}
                  </h3>
                  {client.company_name && (
                    <p className="text-[11px] text-gray-500">{client.full_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {client.hasReport ? (
                    tierBadge(client.packageTier)
                  ) : (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      No Report
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Link
                  href={`/app/projects/report/${client.id}/admin`}
                  className="flex-1 text-center px-3 py-2 bg-gray-900 text-white text-[12px] font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  Builder <ArrowRight size={12} />
                </Link>
                <Link
                  href={`/app/projects/report/${client.id}/view`}
                  className={`flex-1 text-center px-3 py-2 text-[12px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    client.hasReport
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "bg-gray-50 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Viewer <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Workspace>
  );
}
