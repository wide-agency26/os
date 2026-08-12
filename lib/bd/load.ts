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
  };
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
