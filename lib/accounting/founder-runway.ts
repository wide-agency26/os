import { formatEuroExact } from "@/lib/accounting/types";
import { monthlyHoursFromWeekly } from "@/lib/hr/types";

export type FounderRatePerson = {
  id: string;
  full_name: string;
  hourly_rate_cost: number | null;
  wishlist_hourly_rate: number | null;
  max_weekly_hours?: number | null;
};

export function defaultFounderHoursPerMonth(people: FounderRatePerson[]): number {
  if (people.length === 0) return 160;
  const hours = people.map((p) => monthlyHoursFromWeekly(p.max_weekly_hours));
  return Math.round(hours.reduce((s, n) => s + n, 0) / hours.length);
}

export function founderMonthlyDraw(rate: number, hoursPerMonth: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const hours = Number.isFinite(hoursPerMonth) ? Math.max(0, hoursPerMonth) : 0;
  return rate * hours;
}

/** Months of cash if this monthly draw is the only outflow. */
export function monthsOfCash(cash: number, monthlyDraw: number): number | null {
  if (monthlyDraw <= 0) return null;
  if (cash <= 0) return 0;
  return cash / monthlyDraw;
}

export function formatRunwayMonths(months: number | null): string {
  if (months == null) return "∞";
  if (!Number.isFinite(months)) return "—";
  if (months <= 0) return "0 mo";
  const rounded = Math.round(months * 10) / 10;
  return `${rounded} mo`;
}

export function formatRate(rate: number | null | undefined): string {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${formatEuroExact(n)} / hr`;
}
