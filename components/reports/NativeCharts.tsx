"use client";

import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { type ColumnSchema } from "@/lib/data-hub/column-detector";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"
];

// ── Legacy interface (backward-compat) ─────────────────────────────
interface LegacyMetricData {
  date: string;
  stage: string;
  metric_name: string;
  metric_value: number;
}

// ── New generic interface ──────────────────────────────────────────
interface GenericChartProps {
  columns?: ColumnSchema[];
  rows?: Record<string, any>[];
  data?: LegacyMetricData[];  // backward compat
}

export function NativeCharts({ columns, rows, data }: GenericChartProps) {
  // If legacy data is passed, render old-style charts
  if (data && data.length > 0 && !columns) {
    return <LegacyCharts data={data} />;
  }

  // New generic rendering
  if (!columns || !rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-gray-500 text-[14px]">No data available to chart.</p>
      </div>
    );
  }

  const activeCols = columns.filter((c) => !c.ignored);
  const dateCols = activeCols.filter((c) => c.type === "date");
  const numericCols = activeCols.filter((c) => ["number", "percentage", "currency"].includes(c.type));
  const categoryCols = activeCols.filter((c) => c.type === "category");

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      {numericCols.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {numericCols.slice(0, 8).map((col, i) => {
            const values = rows.map((r) => parseFloat(r[col.key])).filter((v) => !isNaN(v));
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = values.length > 0 ? sum / values.length : 0;
            return (
              <div key={col.key} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-1">{col.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {col.type === "currency" ? "$" : ""}
                  {sum >= 1000000 ? `${(sum / 1000000).toFixed(1)}M` : sum >= 1000 ? `${(sum / 1000).toFixed(1)}K` : sum.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  {col.type === "percentage" ? "%" : ""}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Avg: {avg.toLocaleString(undefined, { maximumFractionDigits: 1 })} · {values.length} values
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Time Series — if we have date + numeric columns */}
      {dateCols.length > 0 && numericCols.length > 0 && (
        <TimeSeriesChart
          rows={rows}
          dateCol={dateCols[0]}
          numericCols={numericCols.slice(0, 5)}
        />
      )}

      {/* Category Breakdown — if we have category + numeric columns */}
      {categoryCols.length > 0 && numericCols.length > 0 && (
        <CategoryChart
          rows={rows}
          categoryCol={categoryCols[0]}
          numericCol={numericCols[0]}
        />
      )}

      {/* If no good chart combos, show a table summary */}
      {dateCols.length === 0 && categoryCols.length === 0 && numericCols.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm text-center text-gray-500 text-[13px]">
          <p>This dataset contains primarily text data. Charts are generated automatically when date, number, or category columns are detected.</p>
        </div>
      )}
    </div>
  );
}

// ── Time Series Chart ──────────────────────────────────────────────
function TimeSeriesChart({
  rows,
  dateCol,
  numericCols,
}: {
  rows: Record<string, any>[];
  dateCol: ColumnSchema;
  numericCols: ColumnSchema[];
}) {
  const chartData = useMemo(() => {
    // Group by date, sum numerics
    const map = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const dateVal = row[dateCol.key];
      if (!dateVal) continue;
      if (!map.has(dateVal)) {
        map.set(dateVal, { [dateCol.key]: dateVal });
      }
      const entry = map.get(dateVal)!;
      for (const nc of numericCols) {
        const v = parseFloat(row[nc.key]);
        if (!isNaN(v)) {
          entry[nc.key] = (entry[nc.key] || 0) + v;
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a[dateCol.key]).getTime() - new Date(b[dateCol.key]).getTime()
    );
  }, [rows, dateCol, numericCols]);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h3 className="text-gray-900 font-semibold mb-6">Trend Over Time</h3>
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              {numericCols.map((col, i) => (
                <linearGradient key={col.key} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey={dateCol.key}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "10px",
                border: "none",
                boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
                padding: "12px 16px",
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }} />
            {numericCols.map((col, i) => (
              <Area
                key={col.key}
                type="monotone"
                dataKey={col.key}
                name={col.label}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2.5}
                fill={`url(#grad-${i})`}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Category Breakdown Chart ───────────────────────────────────────
function CategoryChart({
  rows,
  categoryCol,
  numericCol,
}: {
  rows: Record<string, any>[];
  categoryCol: ColumnSchema;
  numericCol: ColumnSchema;
}) {
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const cat = row[categoryCol.key] || "Unknown";
      const v = parseFloat(row[numericCol.key]);
      if (!isNaN(v)) {
        map.set(cat, (map.get(cat) || 0) + v);
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, categoryCol, numericCol]);

  if (chartData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Bar chart */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-6">
          {numericCol.label} by {categoryCol.label}
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#4b5563", fontSize: 12, fontWeight: 500 }}
                width={120}
              />
              <Tooltip
                contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                formatter={(value: any) => [Number(value).toLocaleString(), numericCol.label]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie chart */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-6">Distribution</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                formatter={(value: any) => [Number(value).toLocaleString(), numericCol.label]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Legacy Charts (backward compatibility) ─────────────────────────
function LegacyCharts({ data }: { data: LegacyMetricData[] }) {
  const stageSums = data.reduce((acc, row) => {
    acc[row.stage] = (acc[row.stage] || 0) + row.metric_value;
    return acc;
  }, {} as Record<string, number>);

  const funnelData = [
    { name: "Awareness", value: stageSums["Awareness"] || 0, fill: "#3b82f6" },
    { name: "Consideration", value: stageSums["Consideration"] || 0, fill: "#8b5cf6" },
    { name: "Conversion", value: stageSums["Conversion"] || 0, fill: "#10b981" },
    { name: "Advocacy", value: stageSums["Advocacy"] || 0, fill: "#f59e0b" },
  ].filter((d) => d.value > 0);

  const trendMap = new Map<string, any>();
  data.forEach((row) => {
    if (!trendMap.has(row.date)) trendMap.set(row.date, { date: row.date });
    const entry = trendMap.get(row.date);
    entry[row.stage] = (entry[row.stage] || 0) + row.metric_value;
  });
  const trendData = Array.from(trendMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-6">Pipeline Summary</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "#4b5563", fontSize: 13, fontWeight: 500 }} width={100} />
              <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} formatter={(value: any) => [Number(value).toLocaleString(), "Total"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-6">Performance Trend</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} labelStyle={{ color: "#111827", fontWeight: 600, marginBottom: "4px" }} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "13px" }} />
              <Line type="monotone" dataKey="Awareness" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Consideration" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Conversion" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
