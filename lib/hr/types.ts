/** HR roster shared types & helpers (Phase 1). */

export type RosterStatus = "active" | "paused" | "offboarded" | "pipeline";

export type CompModel =
  | "retainer"
  | "hourly_invoice"
  | "fixed_wage"
  | "referral_percentage"
  | "non_monetary"
  | "equity"
  | "de_full_time_salary";

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
  created_at?: string;
  updated_at?: string;
  engagement_types?: EngagementType | null;
  person_skills?: { skill_id: string; skills: Skill | null }[];
}

export const ROSTER_STATUSES: { value: RosterStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "pipeline", label: "Pipeline" },
  { value: "offboarded", label: "Offboarded" },
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
