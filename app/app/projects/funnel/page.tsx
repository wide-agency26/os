"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  ReportsHubShell,
  reportsProjectLabel,
  type ReportsProjectOption,
} from "@/components/reports/ReportsHubShell";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";
import { Loader2, Lock, Save } from "lucide-react";
import {
  DEFAULT_FUNNEL_CONFIG,
  normalizeFunnelConfig,
  streamsForStage,
  type FunnelStreamId,
  type ProjectFunnelConfig,
} from "@/lib/reports/funnel-config";

function FunnelConfigInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ReportsProjectOption[]>([]);
  const [projectId, setProjectId] = useState(searchParams.get("project") || "");
  const [config, setConfig] = useState<ProjectFunnelConfig>(DEFAULT_FUNNEL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(isFounder(profile?.role));

      const { data } = await supabase
        .from("projects")
        .select("id, title, crm_customers(company, name)")
        .order("title");
      const mapped: ReportsProjectOption[] = (data || []).map((p: any) => {
        const cust = Array.isArray(p.crm_customers) ? p.crm_customers[0] : p.crm_customers;
        return {
          id: p.id,
          title: p.title,
          company: cust?.company || cust?.name,
        };
      });
      setProjects(mapped);
      const fromUrl = searchParams.get("project");
      const next = fromUrl && mapped.some((p) => p.id === fromUrl) ? fromUrl : mapped[0]?.id || "";
      setProjectId(next);
      setLoading(false);
    })();
  }, [supabase, searchParams]);

  const loadConfig = useCallback(async (pid: string) => {
    if (!pid) return;
    const { data } = await (supabase as any)
      .from("project_funnel_configs")
      .select("config")
      .eq("project_id", pid)
      .maybeSingle();
    setConfig(normalizeFunnelConfig(data?.config));
  }, [supabase]);

  useEffect(() => {
    if (projectId) void loadConfig(projectId);
  }, [projectId, loadConfig]);

  const toggleStream = (
    key: "awarenessStreams" | "considerationFallback" | "conversionPrimary" | "conversionSecondary",
    id: FunnelStreamId
  ) => {
    setConfig((prev) => {
      const list = prev[key] as FunnelStreamId[];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, [key]: next };
    });
  };

  const save = async () => {
    if (!projectId) return;
    setSaving(true);
    setMessage(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload = {
        project_id: projectId,
        config,
        updated_by: user?.id || null,
      };
      const { error } = await (supabase as any)
        .from("project_funnel_configs")
        .upsert(payload, { onConflict: "project_id" });
      if (error) throw new Error(error.message);
      setMessage("Funnel mapping saved. General report will recalculate on next view.");
    } catch (e: any) {
      setMessage(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  return (
    <Workspace wide>
      <ReportsHubShell
        projects={projects}
        selectedProjectId={projectId}
        onProjectChange={setProjectId}
        isAdmin={isAdmin}
      />

      <div className="max-w-3xl space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Funnel Configuration</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Map Data Hub metrics to the hourglass stages for{" "}
            <strong>{project ? reportsProjectLabel(project) : "this project"}</strong>.
          </p>
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-[14px] font-bold text-gray-900">1. Awareness</h3>
          <p className="text-[12px] text-gray-500">Select streams that define top-of-funnel volume.</p>
          <div className="flex flex-wrap gap-2">
            {streamsForStage("awareness").map((s) => {
              const on = config.awarenessStreams.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStream("awarenessStreams", s.id)}
                  className={`text-[12px] px-3 py-1.5 rounded-lg border font-medium ${
                    on
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                  title={s.description}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-[12px]">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={config.awarenessMode === "impressions"}
                onChange={() => setConfig((c) => ({ ...c, awarenessMode: "impressions" }))}
              />
              Use total combined impressions
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={config.awarenessMode === "reach"}
                onChange={() => setConfig((c) => ({ ...c, awarenessMode: "reach" }))}
              />
              Prefer unique reach when available
            </label>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-[14px] font-bold text-gray-900">2. Consideration</h3>
          <label className="block text-[12px] font-semibold text-gray-600">Primary metric</label>
          <select
            value={config.considerationPrimary}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                considerationPrimary: e.target.value as FunnelStreamId,
              }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] bg-white"
          >
            {streamsForStage("consideration").map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-[12px] font-semibold text-gray-600">Fallback / additive metrics</p>
          <div className="flex flex-wrap gap-2">
            {streamsForStage("consideration").map((s) => {
              const on = config.considerationFallback.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStream("considerationFallback", s.id)}
                  className={`text-[12px] px-3 py-1.5 rounded-lg border font-medium ${
                    on
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-[14px] font-bold text-gray-900">3. Conversion</h3>
          <p className="text-[12px] text-gray-500">Primary conversion outcomes</p>
          <div className="flex flex-wrap gap-2">
            {streamsForStage("conversion").map((s) => {
              const on = config.conversionPrimary.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStream("conversionPrimary", s.id)}
                  className={`text-[12px] px-3 py-1.5 rounded-lg border font-medium ${
                    on
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-500">
            <Lock size={14} /> 4 & 5. Loyalty & Advocacy
          </div>
          <p className="text-[12px] text-gray-500">
            Disabled — connect CRM / HubSpot / Shopify / referral engines (Coming Soon).
          </p>
        </section>

        <div className="flex items-center justify-between gap-3">
          {message && <p className="text-[12px] text-gray-600">{message}</p>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !projectId}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-[13px] font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save & re-calculate funnel
          </button>
        </div>
      </div>
    </Workspace>
  );
}

export default function FunnelConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      }
    >
      <FunnelConfigInner />
    </Suspense>
  );
}
