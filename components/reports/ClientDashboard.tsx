"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FunnelChart,
  CostCard,
  ConversionChart,
  AssetList,
  ChannelBreakdownChart,
  type WidgetConfig,
} from "./DashboardCharts";

export function ClientDashboard({ clientId }: { clientId: string }) {
  const [layout, setLayout] = useState<WidgetConfig[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  useEffect(() => {
    async function fetchLayoutAndData() {
      setLoading(true);
      try {
        const layoutRes = await fetch(`/api/client/${clientId}/dashboard-layout`);
        const layoutData = await layoutRes.json();

        const currentLayout: WidgetConfig[] = layoutData.layout || [];
        setLayout(currentLayout);

        const allMetrics = new Set<string>();
        currentLayout.forEach((w) => w.metricIds.forEach((m) => allMetrics.add(m)));

        if (allMetrics.size === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        const dataRes = await fetch(`/api/client/${clientId}/reports/fetch-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate,
            endDate,
            metricIds: Array.from(allMetrics),
          }),
        });

        const dataJson = await dataRes.json();
        if (dataJson.data) {
          setData(dataJson.data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLayoutAndData();
  }, [clientId, startDate, endDate]);

  const aggregateData = useMemo(() => {
    const totals: Record<string, number> = {};
    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "date" && typeof row[key] === "number") {
          totals[key] = (totals[key] || 0) + row[key];
        }
      });
    });
    return totals;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/60">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Performance Dashboard</h2>
          <p className="text-xs text-zinc-500 mt-1">Powered by Apache Superset Engine.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] text-zinc-500 uppercase font-semibold mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-zinc-500 uppercase font-semibold mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-[#00FF00] rounded-full animate-spin mb-4" />
          <p>Querying Superset analytics engine...</p>
        </div>
      ) : layout.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
          <p>No dashboard layout has been configured yet.</p>
          <p className="text-xs mt-2 text-zinc-600">Please ask your account manager to set up your report cards.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {layout.map((widget) => {
            if (widget.type === "cost-card") {
              return <div key={widget.id}><CostCard widget={widget} aggregateData={aggregateData} /></div>;
            }
            if (widget.type === "asset-list") {
              return <div key={widget.id}><AssetList widget={widget} aggregateData={aggregateData} /></div>;
            }
            if (widget.type === "channel-breakdown") {
              return <div key={widget.id}><ChannelBreakdownChart widget={widget} aggregateData={aggregateData} /></div>;
            }
            if (widget.type === "conversion-chart") {
              return (
                <div key={widget.id} className="md:col-span-2 lg:col-span-3">
                  <ConversionChart widget={widget} data={data} />
                </div>
              );
            }
            if (widget.type === "funnel-view") {
              return (
                <div key={widget.id} className="md:col-span-2 lg:col-span-3">
                  <FunnelChart widget={widget} aggregateData={aggregateData} />
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
