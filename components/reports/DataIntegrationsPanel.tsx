"use client";

import { useState, useEffect } from "react";

interface Integration {
  id?: string;
  provider: string;
  credentials: Record<string, string>;
  is_connected: boolean;
  last_synced_at?: string;
}

const PROVIDERS = [
  {
    id: "meta_instagram",
    name: "Meta Ads & Instagram",
    description: "Connect Meta Graph API to pull Facebook Ads, Instagram Insights, and Pixel Conversions.",
    fields: [
      { key: "ad_account_id", label: "Ad Account ID (act_...)" },
      { key: "access_token", label: "System User Access Token", type: "password" },
      { key: "pixel_id", label: "Meta Pixel ID (Optional)" },
    ],
    icon: "📱",
  },
  {
    id: "ga4",
    name: "Google Analytics 4 (GA4)",
    description: "Pull web sessions, conversions, bounce rates, and active user metrics via GA4 Data API.",
    fields: [
      { key: "property_id", label: "GA4 Property ID (e.g., 312345678)" },
      { key: "client_email", label: "Service Account Email" },
      { key: "private_key", label: "Service Account Private Key", type: "password" },
    ],
    icon: "📊",
  },
  {
    id: "gsc",
    name: "Google Search Console",
    description: "Fetch organic search impressions, clicks, keyword rankings, and CTR.",
    fields: [
      { key: "site_url", label: "Site Domain URL (sc-domain:example.com)" },
      { key: "client_email", label: "Service Account Email" },
    ],
    icon: "🔍",
  },
  {
    id: "linkedin",
    name: "LinkedIn Ads",
    description: "Track B2B ad spend, lead form submissions, impressions, and video views.",
    fields: [
      { key: "account_id", label: "LinkedIn Sponsored Ads Account ID" },
      { key: "access_token", label: "OAuth 2.0 Access Token", type: "password" },
    ],
    icon: "💼",
  },
  {
    id: "youtube",
    name: "YouTube Analytics",
    description: "Gather channel subscriber growth, video watch time, and top content performance.",
    fields: [
      { key: "channel_id", label: "YouTube Channel ID (UC...)" },
      { key: "api_key", label: "Google Data API Key", type: "password" },
    ],
    icon: "▶️",
  },
];

export function DataIntegrationsPanel({ clientId }: { clientId: string }) {
  const [integrations, setIntegrations] = useState<Record<string, Integration>>({});
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    fetch(`/api/cm/${clientId}/integrations`)
      .then((res) => res.json())
      .then((data) => {
        const map: Record<string, Integration> = {};
        const forms: Record<string, Record<string, string>> = {};

        (data.integrations || []).forEach((item: Integration) => {
          map[item.provider] = item;
          forms[item.provider] = item.credentials || {};
        });

        setIntegrations(map);
        setFormState(forms);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load integrations:", err);
        setLoading(false);
      });
  }, [clientId]);

  const handleFieldChange = (providerId: string, key: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || {}),
        [key]: value,
      },
    }));
  };

  const handleSaveIntegration = async (providerId: string) => {
    setSavingProvider(providerId);
    try {
      const credentials = formState[providerId] || {};
      const res = await fetch(`/api/cm/${clientId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          credentials,
          is_connected: Object.values(credentials).some((v) => Boolean(v)),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setIntegrations((prev) => ({
        ...prev,
        [providerId]: data.integration,
      }));

      alert(`${PROVIDERS.find((p) => p.id === providerId)?.name} connection saved!`);
    } catch (err: any) {
      alert(`Error saving credentials: ${err.message}`);
    } finally {
      setSavingProvider(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading data source connectors...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">Data Source Connections</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Configure API credentials to sync raw data snapshots directly into Apache Superset & PostgreSQL.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {PROVIDERS.map((provider) => {
          const integration = integrations[provider.id];
          const isConnected = integration?.is_connected;
          const isSaving = savingProvider === provider.id;

          return (
            <div key={provider.id} className="border border-zinc-800 rounded-2xl bg-zinc-950 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <h4 className="text-base font-semibold text-zinc-100">{provider.name}</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">{provider.description}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    isConnected
                      ? "bg-[#00FF00]/10 text-[#00FF00] border border-[#00FF00]/30"
                      : "bg-zinc-800/60 text-zinc-400 border border-zinc-700"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-[#00FF00]" : "bg-zinc-500"}`} />
                  {isConnected ? "Connected" : "Not Configured"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                {provider.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      {field.label}
                    </label>
                    <input
                      type={field.type || "text"}
                      value={formState[provider.id]?.[field.key] || ""}
                      onChange={(e) => handleFieldChange(provider.id, field.key, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
                <p className="text-[11px] text-zinc-600">
                  {integration?.last_synced_at
                    ? `Last synced: ${new Date(integration.last_synced_at).toLocaleString()}`
                    : "No sync performed yet"}
                </p>
                <button
                  onClick={() => handleSaveIntegration(provider.id)}
                  disabled={isSaving}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : isConnected ? "Update Connection" : "Connect Data Source"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
