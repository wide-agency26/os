"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import type { PeriodOpts } from "@/lib/reports/aggregation";
import { isPlausibleMonthKey } from "@/lib/reports/ga4-website";

export type DateFilterMode = "all" | "months" | "custom";

export interface MonthOption {
  key: string;
  label: string;
}

export interface DateRangeFilterState {
  mode: DateFilterMode;
  selectedMonths: string[];
  customStart: string;
  customEnd: string;
  setMode: (mode: DateFilterMode) => void;
  setCustomStart: (v: string) => void;
  setCustomEnd: (v: string) => void;
  toggleMonth: (key: string) => void;
  selectAllMonths: () => void;
  periodOpts: PeriodOpts;
}

/** Shared date-range state — Meta Ads month-pill pattern */
export function useDateRangeFilter(): DateRangeFilterState {
  const [mode, setMode] = useState<DateFilterMode>("all");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const toggleMonth = useCallback((key: string) => {
    setMode("months");
    setSelectedMonths((prev) => {
      const next = prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key];
      return next.sort();
    });
  }, []);

  const selectAllMonths = useCallback(() => {
    setMode("all");
    setSelectedMonths([]);
  }, []);

  const periodOpts: PeriodOpts = useMemo(
    () => ({
      mode,
      months: selectedMonths,
      customStart,
      customEnd,
    }),
    [mode, selectedMonths, customStart, customEnd]
  );

  return {
    mode,
    selectedMonths,
    customStart,
    customEnd,
    setMode,
    setCustomStart,
    setCustomEnd,
    toggleMonth,
    selectAllMonths,
    periodOpts,
  };
}

interface DateRangeControlsProps {
  months: MonthOption[];
  state: DateRangeFilterState;
  /** Accent color for active pills — default Meta blue */
  accent?: string;
  rowCountHint?: string | number;
  className?: string;
  sticky?: boolean;
}

/**
 * Standard date control: All months | month pills | Custom range
 * (same interaction model as Meta Ads / Website).
 */
export function DateRangeControls({
  months,
  state,
  accent = "#1877f2",
  rowCountHint,
  className = "",
  sticky = false,
}: DateRangeControlsProps) {
  const {
    mode,
    selectedMonths,
    customStart,
    customEnd,
    setMode,
    setCustomStart,
    setCustomEnd,
    toggleMonth,
    selectAllMonths,
  } = state;

  const safeMonths = useMemo(
    () => months.filter((m) => isPlausibleMonthKey(m.key)),
    [months]
  );

  const activeStyle = {
    backgroundColor: accent,
    borderColor: accent,
    color: "#fff",
  };

  return (
    <div
      className={`bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3 ${
        sticky ? "sticky top-0 z-20" : ""
      } ${className}`}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-700">
        <CalendarRange size={14} style={{ color: accent }} />
        Date range
        {rowCountHint != null && rowCountHint !== "" && (
          <span className="font-normal text-gray-400">— {rowCountHint}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={selectAllMonths}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
            mode === "all"
              ? "text-white"
              : "bg-white text-gray-600 border-gray-200 hover:opacity-90"
          }`}
          style={mode === "all" ? activeStyle : undefined}
        >
          All months
        </button>

        {safeMonths.map((m) => {
          const active = mode === "months" && selectedMonths.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggleMonth(m.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                active ? "text-white" : "bg-white text-gray-600 border-gray-200 hover:opacity-90"
              }`}
              style={active ? activeStyle : undefined}
            >
              {m.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
            mode === "custom"
              ? "text-white"
              : "bg-white text-gray-600 border-gray-200 hover:opacity-90"
          }`}
          style={mode === "custom" ? activeStyle : undefined}
        >
          Custom range
        </button>
      </div>

      {mode === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12px] text-gray-600 flex items-center gap-2">
            From
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-[13px] bg-white text-gray-900"
            />
          </label>
          <label className="text-[12px] text-gray-600 flex items-center gap-2">
            To
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-[13px] bg-white text-gray-900"
            />
          </label>
        </div>
      )}

      {mode === "months" && selectedMonths.length === 0 && (
        <p className="text-[11px] text-amber-600">
          Select at least one month, or switch to All months.
        </p>
      )}

      {safeMonths.length === 0 && (
        <p className="text-[11px] text-gray-400">
          No dated rows yet — upload data with dates to unlock month pills.
        </p>
      )}
    </div>
  );
}

/** Merge unique month keys from several lists — drops implausible junk years */
export function mergeMonthOptions(...lists: MonthOption[][]): MonthOption[] {
  const map = new Map<string, string>();
  for (const list of lists) {
    for (const m of list) {
      if (!/^\d{4}-\d{2}$/.test(m.key)) continue;
      const y = Number(m.key.slice(0, 4));
      const mo = Number(m.key.slice(5, 7));
      const nowY = new Date().getFullYear();
      if (mo < 1 || mo > 12) continue;
      if (y < 2018 || y > nowY + 1) continue;
      map.set(m.key, m.label);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, label]) => ({ key, label }));
}
