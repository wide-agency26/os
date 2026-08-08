"use client";

import { useState } from "react";
import {
  deriveSalaryTotals,
  formatMoney,
  type SalaryBreakdown,
} from "@/lib/hr/types";

type Props = {
  value: SalaryBreakdown;
  onChange: (next: SalaryBreakdown) => void;
};

const EMPLOYEE_FIELDS: { key: keyof SalaryBreakdown; label: string }[] = [
  { key: "gross_salary", label: "Gross salary" },
  { key: "pension_employee", label: "Pension (employee)" },
  { key: "unemployment_employee", label: "Unemployment (employee)" },
  { key: "health_employee", label: "Health (employee)" },
  { key: "care_employee", label: "Care (employee)" },
  { key: "income_tax", label: "Income tax" },
  { key: "post_tax_direct_debit_tk", label: "Post-tax direct debit (TK)" },
];

const EMPLOYER_FIELDS: { key: keyof SalaryBreakdown; label: string }[] = [
  { key: "pension_employer", label: "Pension (employer)" },
  { key: "unemployment_employer", label: "Unemployment (employer)" },
  { key: "health_employer", label: "Health (employer)" },
  { key: "care_employer", label: "Care (employer)" },
  { key: "employer_surcharges", label: "Employer surcharges" },
  { key: "accident_insurance", label: "Accident insurance" },
];

function numField(
  value: SalaryBreakdown,
  key: keyof SalaryBreakdown,
  onChange: (next: SalaryBreakdown) => void
) {
  const raw = value[key];
  return (
    <input
      type="number"
      step="0.01"
      value={raw == null ? "" : String(raw)}
      onChange={(e) => {
        const n = e.target.value === "" ? 0 : Number(e.target.value);
        const partial = { ...value, [key]: Number.isFinite(n) ? n : 0 };
        const totals = deriveSalaryTotals(partial);
        onChange({
          ...partial,
          payslip_payout: totals.payslip_payout,
          true_usable_income: totals.true_usable_income,
        });
      }}
      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
    />
  );
}

export function SalaryBreakdownForm({ value, onChange }: Props) {
  const [open, setOpen] = useState(true);
  const totals = deriveSalaryTotals(value);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left hover:bg-gray-100"
      >
        <span className="text-[13px] font-semibold text-gray-900">
          DE salary breakdown
        </span>
        <span className="text-[12px] text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Period month
              </span>
              <input
                type="number"
                min={1}
                max={12}
                value={value.period_month ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    period_month: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Period year
              </span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={value.period_year ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    period_year: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-3">
                Employee-side
              </p>
              <div className="space-y-3">
                {EMPLOYEE_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[12px] font-semibold text-gray-700">
                      {f.label}
                    </span>
                    {numField(value, f.key, onChange)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-3">
                Employer-side
              </p>
              <div className="space-y-3">
                {EMPLOYER_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[12px] font-semibold text-gray-700">
                      {f.label}
                    </span>
                    {numField(value, f.key, onChange)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                Payslip payout
              </p>
              <p className="text-[15px] font-bold text-blue-900 tabular-nums mt-0.5">
                {formatMoney(totals.payslip_payout)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                True usable income
              </p>
              <p className="text-[15px] font-bold text-emerald-900 tabular-nums mt-0.5">
                {formatMoney(totals.true_usable_income)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
                Total employer cost
              </p>
              <p className="text-[15px] font-bold text-amber-950 tabular-nums mt-0.5">
                {formatMoney(totals.total_employer_cost)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
