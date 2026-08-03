"use client";

import React from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";

interface MetricData {
  date: string;
  stage: string;
  metric_name: string;
  metric_value: number;
}

interface NativeChartsProps {
  data: MetricData[];
}

export function NativeCharts({ data }: NativeChartsProps) {
  // Process data for charts
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-gray-500 text-[14px]">No report data available for this client.</p>
      </div>
    );
  }

  // 1. Funnel Summary (Latest sum per stage)
  // Group by stage and sum
  const stageSums = data.reduce((acc, row) => {
    acc[row.stage] = (acc[row.stage] || 0) + row.metric_value;
    return acc;
  }, {} as Record<string, number>);

  const funnelData = [
    { name: "Awareness", value: stageSums["Awareness"] || 0, fill: "#3b82f6" }, // blue-500
    { name: "Consideration", value: stageSums["Consideration"] || 0, fill: "#8b5cf6" }, // violet-500
    { name: "Conversion", value: stageSums["Conversion"] || 0, fill: "#10b981" }, // emerald-500
    { name: "Advocacy", value: stageSums["Advocacy"] || 0, fill: "#f59e0b" } // amber-500
  ].filter(d => d.value > 0);

  // 2. Trend Over Time
  // Group by date, then stage
  const trendMap = new Map<string, any>();
  data.forEach(row => {
    if (!trendMap.has(row.date)) {
      trendMap.set(row.date, { date: row.date });
    }
    const entry = trendMap.get(row.date);
    entry[row.stage] = (entry[row.stage] || 0) + row.metric_value;
  });

  const trendData = Array.from(trendMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      {/* Funnel Chart */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-6">Pipeline Summary</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={funnelData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 500 }}
                width={100}
              />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [Number(value).toLocaleString(), 'Total']}
              />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]}
                barSize={32}
              >
                {/* Recharts automatically uses the 'fill' attribute from the data array */}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-6">Performance Trend</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '4px' }}
              />
              <Legend 
                iconType="circle" 
                wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }}
              />
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
