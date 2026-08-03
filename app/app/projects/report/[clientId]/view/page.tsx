"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import SupersetEmbed from "@/components/reports/SupersetEmbed";
import FunnelHeader from "@/components/reports/FunnelHeader";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface ClientViewerContentProps {
  clientId: string;
}

function ClientViewerContent({ clientId }: ClientViewerContentProps) {
  const [clientName, setClientName] = useState("Client");
  const [dashboardUuid, setDashboardUuid] = useState<string | null>(null);
  const [packageTier, setPackageTier] = useState("launch");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
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

        // Fetch report config to get the dashboard UUID
        const res = await fetch(`/api/reports/${clientId}/config`);
        if (!res.ok) {
          setError("Unable to load report configuration.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (!data.configs || data.configs.length === 0) {
          setError("No report has been provisioned for this client yet.");
          setLoading(false);
          return;
        }

        const config = data.configs[0];
        setDashboardUuid(config.superset_dashboard_uuid);
        setPackageTier(config.package_tier);
      } catch (err: any) {
        setError(err.message || "Failed to load report.");
      }
      setLoading(false);
    }

    loadConfig();
  }, [clientId]);

  const fetchGuestToken = useCallback(async () => {
    const res = await fetch(`/api/reports/${clientId}/guest-token`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to generate access token");
    }
    const data = await res.json();
    return data.guestToken;
  }, [clientId]);

  if (loading) {
    return (
      <Workspace>
        <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading report…</span>
        </div>
      </Workspace>
    );
  }

  if (error) {
    return (
      <Workspace>
        <div className="max-w-lg mx-auto py-24 text-center">
          <AlertCircle size={36} className="mx-auto text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-800 text-[16px] mb-2">Report Not Available</h3>
          <p className="text-gray-500 text-[13px] mb-6">{error}</p>
          <Link
            href="/app/projects/report"
            className="px-4 py-2 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to Report Center
          </Link>
        </div>
      </Workspace>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Branded Header */}
        <FunnelHeader
          clientName={clientName}
          packageTier={packageTier}
        />

        {/* Embedded Dashboard — Full Width */}
        {dashboardUuid && (
          <SupersetEmbed
            dashboardUuid={dashboardUuid}
            fetchGuestToken={fetchGuestToken}
            className="bg-white border border-gray-200 rounded-xl shadow-sm"
          />
        )}

        {/* Footer */}
        <div className="text-center py-8 text-[11px] text-gray-400">
          Powered by WIDE Agency · Data sources: Google Analytics, Search Console, Meta Ads, Google Ads, LinkedIn
        </div>
      </div>
    </div>
  );
}

export default function ClientViewerPage({
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

  return <ClientViewerContent clientId={clientId} />;
}
