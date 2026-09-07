"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  LEDGER_PILLAR_UI,
  MONTH_SHORT,
  formatEuro,
  type LedgerEntry,
  type LedgerPillar,
} from "@/lib/accounting/types";
import type { DateMonthFilterValue } from "@/components/accounting/DateMonthFilter";
import { totals } from "@/lib/accounting/queries";

type Metric = "profit" | "revenue" | "cost";
type ChartKind = "line" | "bar";

const PILLAR_ORDER: LedgerPillar[] = ["unidentified", "identified", "actual"];

const PILLAR_FILL: Record<LedgerPillar, string> = {
  unidentified: "#d4d4d4",
  identified: "#737373",
  actual: "#111111",
};

const PILLAR_STROKE: Record<LedgerPillar, number> = {
  unidentified: 1.5,
  identified: 2,
  actual: 2.5,
};

const METRICS: { key: Metric; label: string }[] = [
  { key: "profit", label: "Profit" },
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
];

function monthsCovered(filter: DateMonthFilterValue): { key: string; label: string }[] {
  const start = filter.startDate.slice(0, 7);
  const end = filter.endDate.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) {
    return [];
  }
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const endY = Number(end.slice(0, 4));
  const endM = Number(end.slice(5, 7));
  const spanYears = y !== endY;
  const out: { key: string; label: string }[] = [];
  while (y < endY || (y === endY && m <= endM)) {
    if (filter.months.length === 0 || filter.months.includes(m)) {
      out.push({
        key: `${y}-${String(m).padStart(2, "0")}`,
        label: spanYears
          ? `${MONTH_SHORT[m - 1]} '${String(y).slice(2)}`
          : MONTH_SHORT[m - 1],
      });
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function bucketByMonth(entries: LedgerEntry[]) {
  const map = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    if (!e.entry_date) continue;
    const key = e.entry_date.slice(0, 7);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return map;
}

function axisEuro(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1000)}k`;
  return `${sign}€${Math.round(abs)}`;
}

export function AccountingTrendChart({
  filter,
  series,
}: {
  filter: DateMonthFilterValue;
  series: Record<LedgerPillar, LedgerEntry[]>;
}) {
  const [visible, setVisible] = useState<Record<LedgerPillar, boolean>>({
    unidentified: true,
    identified: true,
    actual: true,
  });
  const [metric, setMetric] = useState<Metric>("profit");
  const [kind, setKind] = useState<ChartKind>("line");

  const data = useMemo(() => {
    const months = monthsCovered(filter);
    const buckets: Record<LedgerPillar, Map<string, LedgerEntry[]>> = {
      unidentified: bucketByMonth(series.unidentified),
      identified: bucketByMonth(series.identified),
      actual: bucketByMonth(series.actual),
    };
    return months.map((month) => {
      const row: Record<string, string | number> = {
        key: month.key,
        label: month.label,
      };
      for (const pillar of PILLAR_ORDER) {
        const t = totals(buckets[pillar].get(month.key) || []);
        row[pillar] = t[metric];
      }
      return row;
    });
  }, [filter, series, metric]);

  const active = PILLAR_ORDER.filter((p) => visible[p]);

  function toggle(pillar: LedgerPillar) {
    if (visible[pillar] && active.length === 1) return;
    setVisible((prev) => ({ ...prev, [pillar]: !prev[pillar] }));
  }

  const axisEls = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 11, fill: "#6b7280" }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "#6b7280" }}
        axisLine={false}
        tickLine={false}
        width={48}
        tickFormatter={axisEuro}
      />
      <Tooltip
        cursor={kind === "bar" ? { fill: "#f9fafb" } : { stroke: "#e5e7eb" }}
        formatter={(value, name) => [
          formatEuro(Number(value || 0)),
          LEDGER_PILLAR_UI[name as LedgerPillar]?.title || String(name),
        ]}
        labelFormatter={(label) => String(label)}
        contentStyle={{
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          fontSize: 12,
        }}
      />
    </>
  );

  const chartMargin = { top: 12, right: 12, left: 4, bottom: 4 };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[13px] font-semibold text-gray-900">Month on month</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Actual in black. Leads mid grey. Prospects light grey.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(["line", "bar"] as ChartKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors ${
                  kind === k
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  metric === m.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        {PILLAR_ORDER.map((pillar) => {
          const on = visible[pillar];
          return (
            <button
              key={pillar}
              type="button"
              onClick={() => toggle(pillar)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                on
                  ? "bg-white text-gray-900 border-gray-300"
                  : "bg-gray-50 text-gray-400 border-gray-200"
              }`}
            >
              <span
                className="w-2 h-2 rounded-sm"
                style={{ background: on ? PILLAR_FILL[pillar] : "#e5e7eb" }}
              />
              {LEDGER_PILLAR_UI[pillar].title}
            </button>
          );
        })}
      </div>

      <div className="h-[280px] px-2 pb-2 pt-1">
        {data.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-20">
            No months in this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {kind === "line" ? (
              <LineChart data={data} margin={chartMargin}>
                {axisEls}
                {active.map((pillar) => (
                  <Line
                    key={pillar}
                    type="monotone"
                    dataKey={pillar}
                    name={pillar}
                    stroke={PILLAR_FILL[pillar]}
                    strokeWidth={PILLAR_STROKE[pillar]}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: PILLAR_FILL[pillar] }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={data} margin={chartMargin}>
                {axisEls}
                {active.map((pillar) => (
                  <Bar
                    key={pillar}
                    dataKey={pillar}
                    name={pillar}
                    fill={PILLAR_FILL[pillar]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
