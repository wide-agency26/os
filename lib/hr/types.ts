/** HR roster shared types & helpers. */

export type RosterStatus = "active" | "paused" | "offboarded" | "pipeline";

export type CompModel =
  | "retainer"
  | "hourly_invoice"
  | "fixed_wage"
  | "referral_percentage"
  | "non_monetary"
  | "equity"
  | "de_full_time_salary";

export type CompFrequency = "monthly" | "per_project" | "per_hour" | "one_off" | "n/a";

export type RaciCode = "responsible" | "accountable" | "consulted" | "informed";

export type PipelineStage = "met" | "testing" | "onboarding" | "converted" | "passed";

export type HrDocType = "contract" | "nda" | "mini_job_agreement" | "invoice" | "other";

export interface EngagementType {
  id: string;
  key: string;
  label: string;
  default_comp_model: CompModel;
  assignable_to_tasks: boolean;
  requires_contract_doc: boolean;
  sort_order: number;
}

export interface Skill {
  id: string;
  label: string;
}

export interface PersonRow {
  id: string;
  full_name: string;
  primary_email: string | null;
  phone: string | null;
  engagement_type_id: string | null;
  roster_status: RosterStatus;
  bio_notes: string | null;
  rate_notes: string | null;
  co_founder_track: boolean;
  co_founder_track_notes: string | null;
  person_type: string | null;
  expertise_tags: string[] | null;
  hourly_rate_cost: number | null;
  auth_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
  engagement_types?: EngagementType | null;
  person_skills?: { skill_id: string; skills: Skill | null }[];
}

export interface CompensationRecord {
  id: string;
  person_id: string;
  comp_model: CompModel;
  amount: number | null;
  currency: string;
  frequency: CompFrequency;
  non_monetary_description: string | null;
  referral_percentage: number | null;
  effective_from: string;
  effective_to: string | null;
  accounting_ref_id: string | null;
  notes: string | null;
  salary_breakdowns?: SalaryBreakdown[];
  people?: { full_name: string; engagement_types?: EngagementType | null } | null;
}

export interface SalaryBreakdown {
  id?: string;
  compensation_record_id?: string;
  gross_salary: number;
  pension_employee: number;
  pension_employer: number;
  unemployment_employee: number;
  unemployment_employer: number;
  health_employee: number;
  health_employer: number;
  care_employee: number;
  care_employer: number;
  income_tax: number;
  employer_surcharges: number;
  accident_insurance: number;
  payslip_payout: number;
  post_tax_direct_debit_tk: number;
  true_usable_income: number;
  period_month: number | null;
  period_year: number | null;
}

export const ROSTER_STATUSES: { value: RosterStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "pipeline", label: "Pipeline" },
  { value: "offboarded", label: "Offboarded" },
];

export const COMP_MODELS: { value: CompModel; label: string }[] = [
  { value: "retainer", label: "Retainer" },
  { value: "hourly_invoice", label: "Hourly invoice" },
  { value: "fixed_wage", label: "Fixed wage" },
  { value: "referral_percentage", label: "Referral %" },
  { value: "non_monetary", label: "Non-monetary" },
  { value: "equity", label: "Equity" },
  { value: "de_full_time_salary", label: "DE full-time salary" },
];

export const COMP_FREQUENCIES: { value: CompFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "per_project", label: "Per project" },
  { value: "per_hour", label: "Per hour" },
  { value: "one_off", label: "One-off" },
  { value: "n/a", label: "N/A" },
];

export const PIPELINE_STAGES: { value: PipelineStage; label: string }[] = [
  { value: "met", label: "Met" },
  { value: "testing", label: "Testing" },
  { value: "onboarding", label: "Onboarding" },
  { value: "converted", label: "Converted" },
  { value: "passed", label: "Passed" },
];

export const RACI_OPTIONS: { value: RaciCode; label: string }[] = [
  { value: "responsible", label: "R — Responsible" },
  { value: "accountable", label: "A — Accountable" },
  { value: "consulted", label: "C — Consulted" },
  { value: "informed", label: "I — Informed" },
];

export const HR_DOC_TYPES: { value: HrDocType; label: string }[] = [
  { value: "contract", label: "Contract" },
  { value: "nda", label: "NDA" },
  { value: "mini_job_agreement", label: "Mini-job agreement" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

/** Map engagement type → legacy person_type for capacity consumers. */
export function legacyPersonType(engagementKey: string | null | undefined): string {
  switch (engagementKey) {
    case "core":
      return "Founder";
    case "mini_job":
      return "Intern";
    case "bd_referral_partner":
      return "Partner_Contact";
    case "future_employee":
      return "Employee";
    case "recurring_freelancer":
    case "project_freelancer":
    default:
      return "Freelancer";
  }
}

export function rosterStatusPill(status: RosterStatus): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "paused":
      return "bg-amber-100 text-amber-800";
    case "pipeline":
      return "bg-blue-100 text-blue-800";
    case "offboarded":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function emptySalaryBreakdown(): SalaryBreakdown {
  return {
    gross_salary: 0,
    pension_employee: 0,
    pension_employer: 0,
    unemployment_employee: 0,
    unemployment_employer: 0,
    health_employee: 0,
    health_employer: 0,
    care_employee: 0,
    care_employer: 0,
    income_tax: 0,
    employer_surcharges: 0,
    accident_insurance: 0,
    payslip_payout: 0,
    post_tax_direct_debit_tk: 0,
    true_usable_income: 0,
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
  };
}

/** Derive payout fields from entered statutory amounts (not tax tables). */
export function deriveSalaryTotals(b: SalaryBreakdown): {
  payslip_payout: number;
  true_usable_income: number;
  total_employer_cost: number;
} {
  const employeeDed =
    n(b.pension_employee) +
    n(b.unemployment_employee) +
    n(b.health_employee) +
    n(b.care_employee) +
    n(b.income_tax);
  const payslip = Math.max(0, n(b.gross_salary) - employeeDed);
  const usable = Math.max(0, payslip - n(b.post_tax_direct_debit_tk));
  const employerCost =
    n(b.gross_salary) +
    n(b.pension_employer) +
    n(b.unemployment_employer) +
    n(b.health_employer) +
    n(b.care_employer) +
    n(b.employer_surcharges) +
    n(b.accident_insurance);
  return {
    payslip_payout: round2(payslip),
    true_usable_income: round2(usable),
    total_employer_cost: round2(employerCost),
  };
}

function n(v: number | null | undefined): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function formatMoney(amount: number | null | undefined, currency = "EUR"): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
