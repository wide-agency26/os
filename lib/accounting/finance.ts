import { firstOfMonth, formatEuro } from "@/lib/accounting/types";
import { lastDayOfMonth, monthsCoveredInYear } from "@/lib/hr/compensation";
import { overheadAmountForCoveredMonth } from "@/lib/hr/types";

export type FinanceFrequency = "one_off" | "monthly";

export function asFinanceFrequency(
  value: string | null | undefined
): FinanceFrequency {
  return value === "monthly" ? "monthly" : "one_off";
}

export function dealTypeLabel(frequency: FinanceFrequency): string {
  return frequency === "monthly" ? "Retainer" : "One-off";
}

export function formatDealLabel(
  amount: number | null | undefined,
  frequency: FinanceFrequency
): string | null {
  if (amount == null || amount <= 0) return null;
  const euros = formatEuro(amount);
  return frequency === "monthly" ? `${euros}/mo` : euros;
}

export function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isRecurringFinance(frequency: string | null | undefined): boolean {
  const freq = String(frequency || "").toLowerCase();
  return freq === "monthly" || freq === "quarterly" || freq === "yearly";
}

/** Months in `year` this finance line should post into the ledger. */
export function financeCoveredMonths(
  frequency: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
  year: number
): number[] {
  if (!from) return [];
  if (isRecurringFinance(frequency)) {
    return monthsCoveredInYear(
      { effective_from: from, effective_to: to || null },
      year
    );
  }
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7));
  if (y === year && m >= 1 && m <= 12) return [m];
  return [];
}

export function financeEndDate(
  frequency: FinanceFrequency,
  from: string,
  to: string | null | undefined
): string | null {
  if (frequency === "one_off") {
    const y = Number(from.slice(0, 4));
    const m = Number(from.slice(5, 7));
    if (!y || !m) return to || null;
    return lastDayOfMonth(y, m);
  }
  return to?.trim() ? to : null;
}

export function financeYearBooked(
  amount: number,
  frequency: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
  year = new Date().getFullYear()
): number {
  const months = financeCoveredMonths(frequency, from, to, year);
  const perMonth = overheadAmountForCoveredMonth(amount, frequency || "one_off");
  return Math.round(perMonth * months.length * 100) / 100;
}

export function monthStartIso(from: string | null | undefined): string {
  if (!from) return firstOfMonth(new Date().getFullYear(), new Date().getMonth() + 1);
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7));
  if (!y || !m) return firstOfMonth(new Date().getFullYear(), new Date().getMonth() + 1);
  return firstOfMonth(y, m);
}
