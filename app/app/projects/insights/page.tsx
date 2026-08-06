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
import {
  Loader2,
  Sparkles,
  Pin,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Save,
} from "lucide-react";
import {
  type LoadedDataset,
  computeGeneralFunnel,
  computeAdsOverall,
} from "@/lib/reports/aggregation";
import { detectSubcategory } from "@/lib/data-hub/subcategory";
import { normalizeFunnelConfig, DEFAULT_FUNNEL_CONFIG } from "@/lib/reports/funnel-config";

interface InsightRow {
  id: string;
  category: string;
  title: string;
  impact: string;
  observation: string;
  recommended_action: string;
  pinned: boolean;
  visible: boolean;
  source: string;
}

function InsightsInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ReportsProjectOption[]>([]);
  const [projectId, setProjectId] = useState(searchParams.get("project") || "");
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<InsightRow>>({});
  const [error, setError] = useState<string | null>(null);
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
      setProjectId(
        fromUrl && mapped.some((p) => p.id === fromUrl) ? fromUrl : mapped[0]?.id || ""
      );
      setLoading(false);
    })();
  }, [supabase, searchParams]);

  const loadInsights = useCallback(async (pid: string) => {
    if (!pid) return;
    const { data } = await (supabase as any)
      .from("project_ai_insights")
      .select("*")
      .eq("project_id", pid)
      .order("pinned", { ascending: false })
      .order("sort_order", { ascending: true });
    setInsights((data as InsightRow[]) || []);
  }, [supabase]);

  useEffect(() => {
    if (projectId) void loadInsights(projectId);
  }, [projectId, loadInsights]);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  const buildPayload = async () => {
    const { data: datasets } = await (supabase as any)
      .from("datasets")
      .select("id, name, category, subcategory, columns, row_count, created_at")
      .eq("project_id", projectId);

    const loaded: LoadedDataset[] = [];
    for (const ds of datasets || []) {
      const { data: rows } = await (supabase as any)
        .from("dataset_rows")
        .select("row_data")
        .eq("dataset_id", ds.id)
        .order("row_index")
        .limit(5000);
      loaded.push({
        id: ds.id,
        name: ds.name,
        category: ds.category,
        subcategory: ds.subcategory || detectSubcategory(ds.name, ds.columns),
        createdAt: ds.created_at,
        rowCount: ds.row_count,
        columns: ds.columns || [],
        rows: (rows || []).map((r: any) => r.row_data),
      });
    }

    const { data: cfg } = await (supabase as any)
      .from("project_funnel_configs")
      .select("config")
      .eq("project_id", projectId)
      .maybeSingle();

    const funnel = computeGeneralFunnel(
      loaded,
      { mode: "all", months: [], customStart: "", customEnd: "" },
      normalizeFunnelConfig(cfg?.config || DEFAULT_FUNNEL_CONFIG)
    );
    const ads = computeAdsOverall(loaded, {
      mode: "all",
      months: [],
      customStart: "",
      customEnd: "",
    });

    return {
      projectName: project ? reportsProjectLabel(project) : "Project",
      dateRange: "all available",
      funnelMetrics: {
        awareness: funnel.stages.awareness,
        consideration: funnel.stages.consideration,
        conversion: funnel.stages.conversion,
        awareness_to_consideration_rate:
          funnel.rates.awarenessToConsideration != null
            ? `${funnel.rates.awarenessToConsideration.toFixed(2)}%`
            : null,
        consideration_to_conversion_rate:
          funnel.rates.considerationToConversion != null
            ? `${funnel.rates.considerationToConversion.toFixed(2)}%`
            : null,
      },
      channelSpend: Object.fromEntries(
        (ads.networks || []).map((n) => [n.id, n.spend])
      ),
      channelConversions: Object.fromEntries(
        (ads.networks || []).map((n) => [n.id, n.conversions])
      ),
    };
  };

  const generate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    try {
      const payload = await buildPayload();
      const res = await fetch("/api/reports/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      await loadInsights(projectId);
    } catch (e: any) {
      setError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const updateInsight = async (id: string, patch: Partial<InsightRow>) => {
    const { error: err } = await (supabase as any)
      .from("project_ai_insights")
      .update(patch)
      .eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    await loadInsights(projectId);
    setEditingId(null);
  };

  const deleteInsight = async (id: string) => {
    await (supabase as any).from("project_ai_insights").delete().eq("id", id);
    await loadInsights(projectId);
  };

  const addManual = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error: err } = await (supabase as any)
      .from("project_ai_insights")
      .insert({
        project_id: projectId,
        category: "Custom",
        title: "New strategic observation",
        impact: "medium",
        observation: "",
        recommended_action: "",
        pinned: false,
        visible: true,
        source: "manual",
        sort_order: insights.length,
        created_by: user?.id || null,
      })
      .select("*")
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setInsights((prev) => [...prev, data as InsightRow]);
    setEditingId(data.id);
    setDraft(data);
  };

  const pinnedCount = insights.filter((i) => i.pinned).length;

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

      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="text-amber-500" size={20} />
              AI Insight Center
            </h2>
            <p className="text-[13px] text-gray-500 mt-1">
              {project ? reportsProjectLabel(project) : "Select a project"} — generate, edit, and
              pin up to 3 cards on the General report.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating || !projectId}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Auto-generate new insights
          </button>
        </div>

        {error && (
          <div className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {insights.map((card, idx) => {
            const editing = editingId === card.id;
            return (
              <div
                key={card.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm ${
                  card.pinned ? "border-amber-300 ring-1 ring-amber-100" : "border-gray-200"
                } ${!card.visible ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">
                      Card {idx + 1}
                      {card.source === "manual" ? " · Manual" : " · AI"} · {card.category}
                    </p>
                    {editing ? (
                      <input
                        value={draft.title ?? card.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        className="text-[15px] font-bold text-gray-900 border border-gray-200 rounded-lg px-2 py-1 w-full"
                      />
                    ) : (
                      <h3 className="text-[15px] font-bold text-gray-900">{card.title}</h3>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title={card.pinned ? "Unpin" : "Pin to report"}
                      disabled={!card.pinned && pinnedCount >= 3}
                      onClick={() => void updateInsight(card.id, { pinned: !card.pinned })}
                      className={`p-1.5 rounded-lg border ${
                        card.pinned
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "border-gray-200 text-gray-500"
                      }`}
                    >
                      <Pin size={14} />
                    </button>
                    <button
                      type="button"
                      title={card.visible ? "Hide" : "Show"}
                      onClick={() => void updateInsight(card.id, { visible: !card.visible })}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500"
                    >
                      {card.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(card.id);
                        setDraft(card);
                      }}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteInsight(card.id)}
                      className="p-1.5 rounded-lg border border-gray-200 text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <select
                      value={draft.impact ?? card.impact}
                      onChange={(e) => setDraft((d) => ({ ...d, impact: e.target.value }))}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-[12px]"
                    >
                      {["high", "medium", "positive", "attention"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={draft.observation ?? card.observation}
                      onChange={(e) => setDraft((d) => ({ ...d, observation: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                      placeholder="Observation"
                    />
                    <textarea
                      value={draft.recommended_action ?? card.recommended_action}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, recommended_action: e.target.value }))
                      }
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                      placeholder="Recommended action"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void updateInsight(card.id, {
                          title: draft.title ?? card.title,
                          impact: draft.impact ?? card.impact,
                          observation: draft.observation ?? card.observation,
                          recommended_action:
                            draft.recommended_action ?? card.recommended_action,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[12px]"
                    >
                      <Save size={12} /> Save card
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded mb-2">
                      {card.impact}
                    </span>
                    <p className="text-[13px] text-gray-700 leading-relaxed mb-2">
                      {card.observation || "—"}
                    </p>
                    <p className="text-[12px] text-gray-500">
                      <strong className="text-gray-700">Action:</strong>{" "}
                      {card.recommended_action || "—"}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void addManual()}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-indigo-600 hover:underline"
        >
          <Plus size={14} /> Add custom manual strategic observation
        </button>
      </div>
    </Workspace>
  );
}

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      }
    >
      <InsightsInner />
    </Suspense>
  );
}
