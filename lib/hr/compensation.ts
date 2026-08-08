import type { CompModel, SalaryBreakdown } from "@/lib/hr/types";
import { deriveSalaryTotals } from "@/lib/hr/types";

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
