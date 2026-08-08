"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatEuro, type LedgerPillar } from "@/lib/accounting/types";

type MonthlyPoint = {
  month: number;
  label: string;
  revenue: number;
  cost: number;
};

type ScorecardProps = {
  title: string;
  revenue: number;
  cost: number;
  profit: number;
  monthlySeries: MonthlyPoint[];
  pillarStyle: LedgerPillar;
  defaultExpanded?: boolean;
};

const PILLAR_STYLES: Record<
  LedgerPillar,
  { accent: string; badge: string; bar: string }
> = {
  actual: {
    accent: "border-l-4 border-l-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    bar: "bg-blue-500",
  },
  identified: {
    accent: "border-l-4 border-l-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
  },
  unidentified: {
    accent: "border-l-4 border-l-gray-400",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    bar: "bg-gray-400",
  },
};

export function Scorecard({
  title,
  revenue,
  cost,
  profit,
  monthlySeries,
  pillarStyle,
  defaultExpanded = false,
}: ScorecardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const style = PILLAR_STYLES[pillarStyle];
  const maxVal = Math.max(1, ...monthlySeries.flatMap((m) => [m.revenue, m.cost]));

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white ${style.accent} overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-gray-900">{title}</span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.badge}`}
          >
            {pillarStyle}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      <div className="grid grid-cols-3 gap-2 px-4 pb-4">
        <div>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            <TrendingUp size={11} /> Revenue
          </div>
          <p className="text-[17px] font-semibold text-green-600 tabular-nums">
            {formatEuro(revenue)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            <TrendingDown size={11} /> Cost
          </div>
          <p className="text-[17px] font-semibold text-red-500 tabular-nums">
            {formatEuro(cost)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            <Wallet size={11} /> Profit
          </div>
          <p
            className={`text-[17px] font-semibold tabular-nums ${
              profit >= 0 ? "text-gray-900" : "text-red-600"
            }`}
          >
            {formatEuro(profit)}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4">
          <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Revenue
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> Cost
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-24">
            {monthlySeries.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
                <div className="flex items-end gap-[2px] h-full w-full justify-center">
                  <div
                    className="w-2 rounded-sm bg-emerald-500/80"
                    style={{ height: `${Math.max(2, (m.revenue / maxVal) * 100)}%` }}
                    title={`${m.label} revenue: ${formatEuro(m.revenue)}`}
                  />
                  <div
                    className="w-2 rounded-sm bg-red-400/80"
                    style={{ height: `${Math.max(2, (m.cost / maxVal) * 100)}%` }}
                    title={`${m.label} cost: ${formatEuro(m.cost)}`}
                  />
                </div>
                <span className="text-[9px] text-gray-400">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
