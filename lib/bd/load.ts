import type {
  BdDemandSignal,
  BdLegitimacyStatus,
  BdRecord,
  BdSource,
  BdStage,
  BdStaffOption,
  BdTimelineEntry,
} from "./types";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBdRecord(row: any, staffById?: Map<string, BdStaffOption>): BdRecord {
  const observerIds: string[] = Array.isArray(row.observer_ids)
    ? row.observer_ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const ownerFromJoin = Array.isArray(row.owner)
    ? row.owner[0]
    : row.owner;

  const owner: BdStaffOption | null =
    ownerFromJoin
      ? { id: ownerFromJoin.id, full_name: ownerFromJoin.full_name ?? null }
      : staffById?.get(row.owner_id) ?? null;

  const observers = observerIds
    .map((id) => staffById?.get(id) ?? { id, full_name: null })
    .filter(Boolean);

  return {
    id: row.id,
    name: row.name,
    company_name: row.company_name,
    position: row.position ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    linkedin_url: row.linkedin_url ?? null,
    company_id: row.company_id ?? null,
    contact_id: row.contact_id ?? null,
    source: (row.source as BdSource) || "manual",
    discovery_method: row.discovery_method ?? null,
    stage: row.stage as BdStage,
    stage_entered_at: row.stage_entered_at,
    owner_id: row.owner_id,
    observer_ids: observerIds,
    legitimacy_status: (row.legitimacy_status as BdLegitimacyStatus | null) ?? null,
    legitimacy_reason: row.legitimacy_reason ?? null,
    demand_signals: asArray<BdDemandSignal>(row.demand_signals),
    audit_links: asArray(row.audit_links),
    outreach_log: asArray(row.outreach_log),
    discovery_call: asObject(row.discovery_call),
    proposal: asObject(row.proposal),
    contract: asObject(row.contract),
    quotation: asObject(row.quotation),
    archived_reason: row.archived_reason ?? null,
    next_action_due: row.next_action_due ?? null,
    next_action_label: row.next_action_label ?? null,
    sort_order: row.sort_order ?? 0,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner,
    observers,
    project_id: row.project_id ?? null,
    deal_value: row.deal_value != null ? Number(row.deal_value) : null,
    project_stage: row.project_stage ?? null,
    project_status: row.project_status ?? null,
    project_title: row.project_title ?? null,
    estimate_service: row.estimate_service ?? null,
    estimate_amount:
      row.estimate_amount != null ? Number(row.estimate_amount) : null,
    estimate_frequency:
      row.estimate_frequency === "monthly" ? "monthly" : "one_off",
    estimate_start_date: row.estimate_start_date ?? null,
    estimate_end_date: row.estimate_end_date ?? null,
    logo_url: row.logo_url ?? null,
    website: row.website ?? null,
    offerings: Array.isArray(row.offerings) ? row.offerings : [],
  };
}

export type BdProjectSnap = {
  id: string;
  deal_value: number | null;
  stage: string | null;
  status?: string | null;
  bd_record_id: string | null;
  client_id: string | null;
  title?: string | null;
};

export function indexProjectsForBd(projects: BdProjectSnap[]): {
  byBd: Map<string, BdProjectSnap>;
  byCompany: Map<string, BdProjectSnap[]>;
} {
  const byBd = new Map<string, BdProjectSnap>();
  const byCompany = new Map<string, BdProjectSnap[]>();
  for (const p of projects) {
    if (p.bd_record_id) byBd.set(p.bd_record_id, p);
    if (p.client_id) {
      const list = byCompany.get(p.client_id) ?? [];
      list.push(p);
      byCompany.set(p.client_id, list);
    }
  }
  return { byBd, byCompany };
}

/** Prefer the project directly linked to this BD record. */
export function pickBdProjectFinance(
  record: { id: string; company_id: string | null },
  byBd: Map<string, BdProjectSnap>,
  _byCompany: Map<string, BdProjectSnap[]>
): BdProjectSnap | null {
  return byBd.get(record.id) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTimelineEntry(row: any): BdTimelineEntry {
  const actorRaw = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    bd_record_id: row.bd_record_id,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    action: row.action,
    note: row.note ?? null,
    meta: asObject(row.meta),
    created_at: row.created_at,
    actor: actorRaw
      ? { id: actorRaw.id, full_name: actorRaw.full_name ?? null }
      : null,
  };
}
