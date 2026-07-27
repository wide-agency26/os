"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export type WidgetType = "funnel-view" | "cost-card" | "conversion-chart" | "asset-list" | "channel-breakdown";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  metricIds: string[];
}

const COLORS = ["#00FF00", "#3b82f6", "#a855f7", "#eab308", "#ec4899", "#f97316"];

export function FunnelChart({ widget, aggregateData }: { widget: WidgetConfig; aggregateData: Record<string, number> }) {
  const funnelData = widget.metricIds.map(metric => {
    const val = Object.keys(aggregateData)
      .filter(k => k.endsWith(`_${metric}`))
      .reduce((sum, k) => sum + aggregateData[k], 0);
    return { step: metric.replace("sum__", "").toUpperCase(), value: val };
  });

  return (
    <div className="p-6 border border-zinc-800 rounded-2xl bg-zinc-950/50 h-[300px] flex flex-col shadow-sm">
      <p className="text-sm font-medium text-zinc-400 mb-4">{widget.title}</p>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis type="number" stroke="#52525b" fontSize={12} />
            <YAxis dataKey="step" type="category" stroke="#52525b" fontSize={12} width={100} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
              cursor={{ fill: '#27272a', opacity: 0.4 }}
            />
            <Bar dataKey="value" fill="#00FF00" radius={[0, 4, 4, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CostCard({ widget, aggregateData }: { widget: WidgetConfig; aggregateData: Record<string, number> }) {
  const metric = widget.metricIds[0] || "sum__cost";
  
  const totalVal = Object.keys(aggregateData)
    .filter(k => k.endsWith(`_${metric}`))
    .reduce((sum, k) => sum + aggregateData[k], 0);
    
  const isCurrency = metric.includes("cost") || metric.includes("spend") || metric.includes("revenue");
  const displayValue = isCurrency
    ? `$${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : totalVal.toLocaleString();

  return (
    <div className="p-6 border border-zinc-800 rounded-2xl bg-zinc-950/50 flex flex-col justify-center shadow-sm h-full min-h-[160px]">
      <p className="text-sm font-medium text-zinc-400 mb-1">{widget.title}</p>
      <p className="text-4xl font-bold text-zinc-100">{displayValue}</p>
      <p className="text-xs text-zinc-600 mt-2 uppercase tracking-wider">{metric.replace("sum__", "")}</p>
    </div>
  );
}

export function ConversionChart({ widget, data }: { widget: WidgetConfig; data: any[] }) {
  const metric = widget.metricIds[0] || "sum__conversions";
  
  const chartData = data.map(row => {
    const dailySum = Object.keys(row)
      .filter(k => k.endsWith(`_${metric}`))
      .reduce((sum, k) => sum + (Number(row[k]) || 0), 0);
    return { date: row.date, [metric]: dailySum };
  });

  return (
    <div className="p-6 border border-zinc-800 rounded-2xl bg-zinc-950/50 h-[350px] flex flex-col shadow-sm">
      <p className="text-sm font-medium text-zinc-400 mb-6">{widget.title}</p>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#52525b" 
              fontSize={12}
              tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            />
            <YAxis stroke="#52525b" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
              itemStyle={{ color: '#00FF00' }}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke="#00FF00"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: "#00FF00", stroke: "#09090b", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AssetList({ widget, aggregateData }: { widget: WidgetConfig; aggregateData: Record<string, number> }) {
  const metric = widget.metricIds[0] || "sum__conversions";
  const sources = Object.keys(aggregateData)
    .filter(k => k.endsWith(`_${metric}`))
    .map(k => ({
      name: k.replace(`_${metric}`, ""),
      value: aggregateData[k]
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="p-6 border border-zinc-800 rounded-2xl bg-zinc-950/50 flex flex-col shadow-sm h-full min-h-[160px]">
      <p className="text-sm font-medium text-zinc-400 mb-4">{widget.title}</p>
      <div className="space-y-3">
        {sources.length > 0 ? sources.map(src => (
          <div key={src.name} className="flex justify-between items-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <span className="text-sm font-medium text-zinc-200 capitalize">{src.name}</span>
            <span className="text-sm font-bold text-[#00FF00]">{src.value.toLocaleString()}</span>
          </div>
        )) : (
          <div className="text-xs text-zinc-600">No data available</div>
        )}
      </div>
    </div>
  );
}

export function ChannelBreakdownChart({ widget, aggregateData }: { widget: WidgetConfig; aggregateData: Record<string, number> }) {
  const metric = widget.metricIds[0] || "sum__impressions";
  const pieData = Object.keys(aggregateData)
    .filter(k => k.endsWith(`_${metric}`))
    .map(k => ({
      name: k.replace(`_${metric}`, "").toUpperCase(),
      value: aggregateData[k]
    }))
    .filter(d => d.value > 0);

  return (
    <div className="p-6 border border-zinc-800 rounded-2xl bg-zinc-950/50 h-[300px] flex flex-col shadow-sm">
      <p className="text-sm font-medium text-zinc-400 mb-2">{widget.title}</p>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData.length > 0 ? pieData : [{ name: "META", value: 40 }, { name: "GA4", value: 35 }, { name: "LINKEDIN", value: 25 }]}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
