export type BdSource = "manual" | "auto_discovered";

export type BdStage =
  | "prospect"
  | "qualifying"
  | "qualified_lead"
  | "outreach"
  | "discovery_call"
  | "proposal_sent"
  | "contract"
  | "quotation"
  | "client_won"
  | "on_hold"
  | "declined"
  | "archived";

export type BdLegitimacyStatus = "pass" | "fail" | "uncertain";

export type BdDemandSignal = {
  type: string;
  description: string;
  source: string;
  date_found: string;
};

export type BdTimelineActorType = "system" | "user";

export type BdTimelineEntry = {
  id: string;
  bd_record_id: string;
  actor_type: BdTimelineActorType;
  actor_id: string | null;
  action: string;
  note: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor?: { id: string; full_name: string | null } | null;
};

export type BdStaffOption = {
  id: string;
  full_name: string | null;
};

export type BdRecord = {
  id: string;
  name: string;
  company_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  company_id: string | null;
  contact_id: string | null;
  source: BdSource;
  discovery_method: string | null;
  stage: BdStage;
  stage_entered_at: string;
  owner_id: string;
  observer_ids: string[];
  legitimacy_status: BdLegitimacyStatus | null;
  legitimacy_reason: string | null;
  demand_signals: BdDemandSignal[];
  audit_links: unknown[];
  outreach_log: unknown[];
  discovery_call: Record<string, unknown>;
  proposal: Record<string, unknown>;
  contract: Record<string, unknown>;
  quotation: Record<string, unknown>;
  archived_reason: string | null;
  next_action_due: string | null;
  next_action_label: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  owner?: BdStaffOption | null;
  observers?: BdStaffOption[];
  timeline?: BdTimelineEntry[];
};

export type BdBoardFilters = {
  ownerId?: string | null;
  source?: BdSource | "all" | null;
  stage?: BdStage | "all" | null;
  legitimacy?: BdLegitimacyStatus | "all" | "unset" | null;
};
