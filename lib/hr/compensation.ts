import type {
  CompFrequency,
  CompModel,
  CompensationRecord,
  SalaryBreakdown,
} from "@/lib/hr/types";
import {
  COMP_MODELS,
  deriveSalaryTotals,
  formatMoney,
} from "@/lib/hr/types";

/** Accounting-facing cost for a compensation record. */
export function accountingCostForRecord(args: {
  comp_model: CompModel;
  amount: number | null;
  breakdown?: SalaryBreakdown | null;
}): number {
  if (args.comp_model === "de_full_time_salary" && args.breakdown) {
    return deriveSalaryTotals(args.breakdown).total_employer_cost;
  }
  return Number(args.amount || 0);
}

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Month is 1–12. */
export function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

/** Month is 1–12. */
export function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Whether a compensation record overlaps a calendar month (1–12). */
export function recordCoversMonth(
  record: Pick<CompensationRecord, "effective_from" | "effective_to">,
  year: number,
  month: number
): boolean {
  const from = parseIsoDate(record.effective_from);
  if (!from) return false;
  const monthStart = `${year}-${pad2(month)}-01`;
  const monthEnd = lastDayOfMonth(year, month);
  if (record.effective_from > monthEnd) return false;
  if (record.effective_to && record.effective_to < monthStart) return false;
  return true;
}

/** Months (1–12) in `year` covered by the record. */
export function monthsCoveredInYear(
  record: Pick<CompensationRecord, "effective_from" | "effective_to">,
  year: number
): number[] {
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) {
    if (recordCoversMonth(record, year, m)) out.push(m);
  }
  return out;
}

export function recordTouchesYear(
  record: Pick<CompensationRecord, "effective_from" | "effective_to">,
  year: number
): boolean {
  return monthsCoveredInYear(record, year).length > 0;
}

export function shortCompValue(record: CompensationRecord): string {
  if (record.comp_model === "referral_percentage") {
    return record.referral_percentage != null
      ? `${record.referral_percentage}%`
      : "—";
  }
  if (record.comp_model === "non_monetary") {
    return record.non_monetary_description?.trim() || "Non-cash";
  }
  if (record.comp_model === "de_full_time_salary") {
    const sb = record.salary_breakdowns?.[0];
    if (!sb) return "Salary";
    return formatMoney(
      deriveSalaryTotals(sb).total_employer_cost,
      record.currency
    );
  }
  return formatMoney(record.amount, record.currency);
}

export function compModelLabel(model: CompModel): string {
  return COMP_MODELS.find((x) => x.value === model)?.label || model;
}

export function spanKindFromFrequency(
  frequency: CompFrequency
): "recurring" | "one_off" {
  return frequency === "one_off" ? "one_off" : "recurring";
}

/** Soft color chip for month cells by frequency / model. */
export function monthCellTone(
  record: Pick<CompensationRecord, "frequency" | "comp_model">
): string {
  if (record.frequency === "one_off") {
    return "bg-amber-50 border-amber-200 text-amber-900";
  }
  if (record.comp_model === "de_full_time_salary") {
    return "bg-indigo-50 border-indigo-200 text-indigo-900";
  }
  if (record.comp_model === "equity" || record.comp_model === "non_monetary") {
    return "bg-violet-50 border-violet-200 text-violet-900";
  }
  return "bg-sky-50 border-sky-200 text-sky-900";
}
