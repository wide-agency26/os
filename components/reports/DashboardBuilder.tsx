"use client";

import { useState, useEffect } from "react";
import {
  FunnelChart,
  CostCard,
  ConversionChart,
  AssetList,
  ChannelBreakdownChart,
  type WidgetConfig,
  type WidgetType,
} from "./DashboardCharts";
import { DataIntegrationsPanel } from "./DataIntegrationsPanel";

const WIDGET_DEFINITIONS: Record<WidgetType, { label: string; defaultMetrics: string[] }> = {
  "cost-card": { label: "Multi-Channel Cost Card", defaultMetrics: ["sum__cost"] },
  "conversion-chart": { label: "Conversion Line Chart", defaultMetrics: ["sum__conversions"] },
  "funnel-view": { label: "Funnel View", defaultMetrics: ["sum__impressions", "sum__clicks", "sum__conversions"] },
  "asset-list": { label: "Top Performing Assets List", defaultMetrics: ["sum__conversions"] },
  "channel-breakdown": { label: "Channel Performance Breakdown", defaultMetrics: ["sum__impressions"] },
};

function generateMockData(metricIds: string[]) {
  const aggregateData: Record<string, number> = {};
  const sources = ["meta", "ga4", "gsc", "linkedin", "youtube"];

  sources.forEach((src) => {
    metricIds.forEach((m, i) => {
      aggregateData[`${src}_${m}`] = Math.floor(12500 / Math.pow(5, i)) + Math.floor(Math.random() * 200);
    });
  });

  const timeSeriesData = [];
  let baseVal = 100;
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (30 - i));
    const row: any = { date: date.toISOString().split("T")[0] };

    sources.forEach((src) => {
      metricIds.forEach((m) => {
        baseVal = baseVal + (Math.random() * 10 - 3);
        row[`${src}_${m}`] = Math.max(10, Math.floor(baseVal));
      });
    });
    timeSeriesData.push(row);
  }

  return { aggregateData, timeSeriesData };
}

export function DashboardBuilder({ clientId }: { clientId: string }) {
  const [activeTab, setActiveTab] = useState<"builder" | "integrations">("builder");
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/cm/${clientId}/dashboard-layout`)
      .then((res) => res.json())
      .then((data) => {
        if (data.layout) setWidgets(data.layout);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard layout:", err);
        setLoading(false);
      });
  }, [clientId]);

  const addWidget = (type: WidgetType) => {
    setWidgets([
      ...widgets,
      {
        id: Math.random().toString(36).substring(7),
        type,
        title: WIDGET_DEFINITIONS[type].label,
        metricIds: [...WIDGET_DEFINITIONS[type].defaultMetrics],
      },
    ]);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id));
  };

  const updateWidget = (id: string, updates: Partial<WidgetConfig>) => {
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  const moveWidget = (index: number, direction: -1 | 1) => {
    const newWidgets = [...widgets];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newWidgets.length) return;

    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;
    setWidgets(newWidgets);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cm/${clientId}/dashboard-layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout_config: widgets }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unknown server error");
      }

      alert("Dashboard Layout Saved Successfully! Changes are now live on the client side.");
    } catch (err: any) {
      alert(`Error saving layout: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading Dashboard Builder...</div>;

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("builder")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "builder"
              ? "border-[#00FF00] text-[#00FF00]"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Visual Dashboard Builder
        </button>
        <button
          onClick={() => setActiveTab("integrations")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "integrations"
              ? "border-[#00FF00] text-[#00FF00]"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Data Sources & Integrations
        </button>
      </div>

      {activeTab === "integrations" ? (
        <DataIntegrationsPanel clientId={clientId} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-black/80 backdrop-blur-md py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">WYSIWYG Dashboard Builder</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Customize visual components and save layout directly to the client dashboard.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#00FF00] px-5 py-2.5 text-sm font-bold text-zinc-900 hover:bg-[#00cc00] shadow-lg shadow-[#00FF00]/10 transition-all"
            >
              {saving ? "Saving..." : "Save Report Configuration"}
            </button>
          </div>

          {/* Add Component Toolbar */}
          <div className="flex flex-wrap items-center gap-3 p-4 border border-zinc-800 rounded-xl bg-zinc-900/50">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Add Card:</span>
            {(Object.keys(WIDGET_DEFINITIONS) as WidgetType[]).map((type) => (
              <button
                key={type}
                onClick={() => addWidget(type)}
                className="text-xs bg-zinc-800 px-3 py-1.5 rounded-lg text-zinc-200 hover:bg-zinc-700 font-medium transition-colors border border-zinc-700"
              >
                + {WIDGET_DEFINITIONS[type].label}
              </button>
            ))}
          </div>

          {/* Widget Cards List */}
          <div className="space-y-6">
            {widgets.map((widget, idx) => {
              const { aggregateData, timeSeriesData } = generateMockData(widget.metricIds);

              return (
                <div key={widget.id} className="border border-zinc-800 rounded-2xl bg-zinc-950 overflow-hidden shadow-lg">
                  {/* Visual Preview */}
                  <div className="bg-black/40 p-6">
                    {widget.type === "cost-card" && <CostCard widget={widget} aggregateData={aggregateData} />}
                    {widget.type === "asset-list" && <AssetList widget={widget} aggregateData={aggregateData} />}
                    {widget.type === "conversion-chart" && <ConversionChart widget={widget} data={timeSeriesData} />}
                    {widget.type === "funnel-view" && <FunnelChart widget={widget} aggregateData={aggregateData} />}
                    {widget.type === "channel-breakdown" && <ChannelBreakdownChart widget={widget} aggregateData={aggregateData} />}
                  </div>

                  {/* Editor Controls */}
                  <div className="bg-zinc-900/90 p-4 border-t border-zinc-800 flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => moveWidget(idx, -1)}
                        disabled={idx === 0}
                        className="text-zinc-500 hover:text-white disabled:opacity-30 text-xs p-1"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveWidget(idx, 1)}
                        disabled={idx === widgets.length - 1}
                        className="text-zinc-500 hover:text-white disabled:opacity-30 text-xs p-1"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                          Card Title
                        </label>
                        <input
                          type="text"
                          value={widget.title}
                          onChange={(e) => updateWidget(widget.id, { title: e.target.value })}
                          className="w-full mt-1 bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                          Superset Metrics (Comma Separated)
                        </label>
                        <input
                          type="text"
                          value={widget.metricIds.join(", ")}
                          onChange={(e) =>
                            updateWidget(widget.id, {
                              metricIds: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          className="w-full mt-1 bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono focus:outline-none focus:border-zinc-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                          Component Type
                        </label>
                        <div className="mt-1 px-3 py-2 text-sm text-zinc-400 bg-black/50 rounded-lg border border-transparent">
                          {WIDGET_DEFINITIONS[widget.type]?.label || widget.type}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeWidget(widget.id)}
                      className="text-rose-500 text-xs font-semibold hover:underline bg-rose-500/10 px-3 py-2 rounded-lg shrink-0"
                    >
                      Remove Card
                    </button>
                  </div>
                </div>
              );
            })}

            {widgets.length === 0 && (
              <div className="text-center p-12 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                No cards added yet. Click one of the buttons above to build the client dashboard layout.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
