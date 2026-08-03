"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import ReportProvisionForm from "@/components/reports/ReportProvisionForm";
import SupersetEmbed from "@/components/reports/SupersetEmbed";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, Settings, Loader2 } from "lucide-react";

interface AdminBuilderContentProps {
  clientId: string;
}

function AdminBuilderContent({ clientId }: AdminBuilderContentProps) {
  const [clientName, setClientName] = useState("Client");
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewConfig, setPreviewConfig] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    // Fetch client info
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", clientId)
      .single();

    if (profile) {
      setClientName(profile.company_name || profile.full_name || "Client");
    }

    // Fetch existing report configs
    const res = await fetch(`/api/reports/${clientId}/config`);
    if (res.ok) {
      const data = await res.json();
      setConfigs(data.configs || []);
      if (data.configs?.length > 0) {
        setPreviewConfig(data.configs[0]);
      }
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchGuestToken = useCallback(async () => {
    const res = await fetch(`/api/reports/${clientId}/guest-token`);
    if (!res.ok) throw new Error("Failed to fetch guest token");
    const data = await res.json();
    return data.guestToken;
  }, [clientId]);

  if (loading) {
    return (
      <Workspace>
        <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading…</span>
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/app/projects/report"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Settings size={18} className="text-gray-500" />
              Report Builder — {clientName}
            </h2>
            <p className="text-gray-500 text-[12px]">
              Provision, configure, and preview Superset dashboards.
            </p>
          </div>
        </div>

        {previewConfig && (
          <Link
            href={`/app/projects/report/${clientId}/view`}
            className="px-4 py-2 bg-blue-50 text-blue-700 font-medium text-[12px] rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
          >
            <Eye size={14} />
            Open Client View
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Controls */}
        <div className="xl:col-span-1 space-y-6">
          {/* Provision Form */}
          <ReportProvisionForm
            clientId={clientId}
            clientName={clientName}
            onProvisioned={() => loadData()}
          />

          {/* Active Configurations */}
          {configs.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-bold text-gray-900 text-[13px]">Active Configurations</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {configs.map((c: any) => (
                  <div
                    key={c.id}
                    className={`px-6 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                      previewConfig?.id === c.id ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    onClick={() => setPreviewConfig(c)}
                  >
                    <div>
                      <span className="font-medium text-gray-800 text-[12px] uppercase">
                        {c.package_tier.replace("_", " ")}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Dashboard #{c.superset_dashboard_id}
                      </p>
                    </div>
                    {process.env.NEXT_PUBLIC_SUPERSET_URL && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_SUPERSET_URL}/superset/dashboard/${c.superset_dashboard_id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Preview */}
        <div className="xl:col-span-2">
          {previewConfig ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 text-[14px]">Live Preview</h3>
                <span className="text-[11px] text-gray-400">
                  UUID: {previewConfig.superset_dashboard_uuid?.slice(0, 8)}…
                </span>
              </div>
              <SupersetEmbed
                dashboardUuid={previewConfig.superset_dashboard_uuid}
                fetchGuestToken={fetchGuestToken}
                className="border border-gray-200 rounded-xl shadow-sm"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
              <Settings size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-[13px]">
                No dashboard provisioned yet. Use the form on the left to clone a template.
              </p>
            </div>
          )}
        </div>
      </div>
    </Workspace>
  );
}

export default function AdminBuilderPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setClientId(p.clientId));
  }, [params]);

  if (!clientId) {
    return (
      <Workspace>
        <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      </Workspace>
    );
  }

  return <AdminBuilderContent clientId={clientId} />;
}
