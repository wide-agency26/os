"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  monthlySeries?: MonthlyPoint[];
  pillarStyle: LedgerPillar;
  defaultExpanded?: boolean;
  size?: "featured" | "compact";
  selected?: boolean;
  onSelect?: () => void;
};

export function Scorecard({
  title,
  revenue,
  cost,
  profit,
  monthlySeries,
  pillarStyle,
  defaultExpanded = false,
  size = "compact",
  selected = false,
  onSelect,
}: ScorecardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const featured = size === "featured";
  const selectable = Boolean(onSelect);
  const maxVal = Math.max(
    1,
    ...(monthlySeries || []).flatMap((m) => [m.revenue, m.cost])
  );

  const edge =
    pillarStyle === "actual"
      ? "border-l-gray-950"
      : pillarStyle === "identified"
        ? "border-l-gray-500"
        : "border-l-gray-300";

  function handleClick() {
    if (onSelect) onSelect();
    else setExpanded((v) => !v);
  }

  return (
    <div
      className={`rounded-lg border bg-white overflow-hidden border-l-4 ${edge} ${
        selected ? "border-gray-900 shadow-sm" : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-semibold text-gray-900 ${
              featured ? "text-[13px] uppercase tracking-wide" : "text-[13px]"
            }`}
          >
            {title}
          </span>
          {selectable ? (
            <span className="text-[11px] font-medium text-gray-400">
              {selected ? "Open" : "View"}
            </span>
          ) : expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
        <p
          className={`mt-2 font-semibold tabular-nums text-gray-950 ${
            featured ? "text-3xl tracking-tight" : "text-xl"
          }`}
        >
          {formatEuro(profit)}
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5">Profit</p>
        <div className={`grid grid-cols-2 gap-3 ${featured ? "mt-4" : "mt-3"}`}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              In
            </p>
            <p className="text-[15px] font-semibold text-gray-900 tabular-nums">
              {formatEuro(revenue)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Out
            </p>
            <p className="text-[15px] font-semibold text-gray-600 tabular-nums">
              {formatEuro(cost)}
            </p>
          </div>
        </div>
      </button>

      {!selectable && expanded && monthlySeries && monthlySeries.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4">
          <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-gray-900 inline-block" /> In
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-gray-400 inline-block" /> Out
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-24">
            {monthlySeries.map((m) => (
              <div
                key={m.month}
                className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full"
              >
                <div className="flex items-end gap-[2px] h-full w-full justify-center">
                  <div
                    className="w-2 rounded-sm bg-gray-900/80"
                    style={{
                      height: `${Math.max(2, (m.revenue / maxVal) * 100)}%`,
                    }}
                    title={`${m.label} in: ${formatEuro(m.revenue)}`}
                  />
                  <div
                    className="w-2 rounded-sm bg-gray-400/80"
                    style={{
                      height: `${Math.max(2, (m.cost / maxVal) * 100)}%`,
                    }}
                    title={`${m.label} out: ${formatEuro(m.cost)}`}
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
