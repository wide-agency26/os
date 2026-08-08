"use client";

import { Calendar, X } from "lucide-react";
import { MONTH_SHORT } from "@/lib/accounting/types";

export type DateMonthFilterValue = {
  startDate: string;
  endDate: string;
  /** Selected month numbers 1-12. Empty = all months in range. */
  months: number[];
};

export function defaultFyFilter(d = new Date()): DateMonthFilterValue {
  const year = d.getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, months: [] };
}

export function isMonthInFilter(months: number[], entryDate: string | null | undefined): boolean {
  if (!entryDate) return false;
  if (months.length === 0) return true;
  const m = Number(entryDate.slice(5, 7));
  return months.includes(m);
}

type Props = {
  value: DateMonthFilterValue;
  onChange: (value: DateMonthFilterValue) => void;
};

export function DateMonthFilter({ value, onChange }: Props) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const toggleMonth = (m: number) => {
    const has = value.months.includes(m);
    const months = has
      ? value.months.filter((x) => x !== m)
      : [...value.months, m].sort((a, b) => a - b);
    onChange({ ...value, months });
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-gray-500 shrink-0">
          <Calendar size={14} />
          <span className="text-[13px] font-medium">Range</span>
        </div>
        <input
          type="date"
          value={value.startDate}
          onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          className="text-[13px] px-2.5 py-1.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-gray-400 text-[13px]">to</span>
        <input
          type="date"
          value={value.endDate}
          onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          className="text-[13px] px-2.5 py-1.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => onChange(defaultFyFilter())}
          className="text-[12px] text-blue-600 hover:underline"
        >
          Reset to {currentYear}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {MONTH_SHORT.map((label, idx) => {
          const m = idx + 1;
          const selected = value.months.includes(m);
          const isCurrent = m === currentMonth;
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggleMonth(m)}
              title={isCurrent ? `${label} — current month` : label}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                selected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              } ${isCurrent ? "ring-2 ring-offset-1 ring-blue-300" : ""}`}
            >
              {label}
            </button>
          );
        })}
        {value.months.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...value, months: [] })}
            className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-gray-600 ml-1"
          >
            <X size={11} /> Clear months
          </button>
        )}
      </div>
    </div>
  );
}
