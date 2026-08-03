"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface Template {
  id: number;
  dashboard_title: string;
  slug: string | null;
}

interface ReportProvisionFormProps {
  clientId: string;
  clientName: string;
  onProvisioned?: (config: any) => void;
}

const TIERS = [
  { value: "mvb", label: "MVB", desc: "Digital GTM, Branding, Basic SEO" },
  { value: "launch", label: "Launch", desc: "Strategy, Website, SEO, Organic Social" },
  { value: "growth", label: "Growth", desc: "Analytics, Campaigns, Paid Ads, Video" },
  { value: "full_partnership", label: "Full Partnership", desc: "CRM, Advocacy, Messaging, Brand" },
];

/**
 * ReportProvisionForm — Admin control panel for cloning a Superset dashboard template
 * for a specific client at a specific tier level.
 */
export default function ReportProvisionForm({
  clientId,
  clientName,
  onProvisioned,
}: ReportProvisionFormProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState("launch");
  const [loading, setLoading] = useState(false);
  const [fetchingTemplates, setFetchingTemplates] = useState(true);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/reports/templates");
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.dashboards || []);
          if (data.dashboards?.length > 0) {
            setSelectedTemplate(data.dashboards[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      }
      setFetchingTemplates(false);
    }
    fetchTemplates();
  }, []);

  const handleProvision = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/reports/${clientId}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateDashboardId: selectedTemplate,
          packageTier: selectedTier,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: "Report provisioned successfully." });
        onProvisioned?.(data.config);
      } else {
        setResult({ success: false, message: data.error || "Failed to provision report." });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }

    setLoading(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-200">
        <h3 className="font-bold text-gray-900 text-[15px] flex items-center gap-2">
          <Copy size={16} className="text-blue-600" />
          Provision Report Dashboard
        </h3>
        <p className="text-[12px] text-gray-500 mt-1">
          Clone a master Superset template for <strong>{clientName}</strong>
        </p>
      </div>

      {/* Form */}
      <div className="p-6 space-y-5">
        {/* Template Selector */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
            Master Template
          </label>
          {fetchingTemplates ? (
            <div className="flex items-center gap-2 text-gray-400 text-[12px] py-2">
              <Loader2 size={14} className="animate-spin" /> Loading templates from Superset…
            </div>
          ) : templates.length === 0 ? (
            <div className="text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              No templates found. Ensure your Superset instance is configured and has master dashboards.
            </div>
          ) : (
            <select
              value={selectedTemplate ?? ""}
              onChange={(e) => setSelectedTemplate(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.dashboard_title} (ID: {t.id})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Tier Selector */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">
            Package Tier
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map((tier) => (
              <button
                key={tier.value}
                onClick={() => setSelectedTier(tier.value)}
                className={`text-left px-3 py-2.5 rounded-lg border text-[12px] transition-all ${
                  selectedTier === tier.value
                    ? "border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="font-semibold">{tier.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{tier.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div
            className={`flex items-start gap-2 px-4 py-3 rounded-lg text-[12px] ${
              result.success
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {result.success ? (
              <CheckCircle size={14} className="text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
            )}
            <span>{result.message}</span>
          </div>
        )}

        {/* Action */}
        <button
          onClick={handleProvision}
          disabled={loading || !selectedTemplate || fetchingTemplates}
          className="w-full py-2.5 bg-blue-600 text-white font-medium text-[13px] rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Provisioning…
            </>
          ) : (
            <>
              <Copy size={14} />
              Clone Template & Provision
            </>
          )}
        </button>
      </div>
    </div>
  );
}
