export const CONTEXT_ENTRY_TYPES = [
  "note",
  "comment",
  "document_ref",
  "channel",
  "module_finalized",
  "crm_activity",
  "strategy_reference",
] as const;

export type ContextEntryType = (typeof CONTEXT_ENTRY_TYPES)[number] | (string & {});

export const CONTEXT_ENTRY_STATUSES = ["active", "archived", "superseded"] as const;
export type ContextEntryStatus = (typeof CONTEXT_ENTRY_STATUSES)[number];

/** Open-ended payload every module uses to write into Context Bank. */
export type ContextBankPayload = {
  company_id: string;
  project_id?: string | null;
  entry_type: ContextEntryType;
  source_type?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  title?: string | null;
  content: string;
  is_system_generated: boolean;
  created_by?: string | null;
};

export type ContextEntry = {
  id: string;
  company_id: string;
  project_id: string | null;
  entry_type: string;
  source_type: string | null;
  source_table: string | null;
  source_id: string | null;
  title: string | null;
  content: string;
  status: ContextEntryStatus;
  is_system_generated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  project_title?: string | null;
};

export type ContextDigest = {
  id: string;
  company_id: string;
  project_id: string | null;
  digest: string;
  entries_covered_through: string;
  generated_at: string;
};

export type ContextEntryFilters = {
  companyId: string;
  projectId?: string | null;
  entryType?: string | null;
  from?: string | null;
  to?: string | null;
  includeInactive?: boolean;
};

export const CONTEXT_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  comment: "Comment",
  document_ref: "Document",
  channel: "Channel",
  module_finalized: "Finalized",
  crm_activity: "CRM",
  strategy_reference: "Strategy",
};
