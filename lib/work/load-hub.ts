import type { WorkGroup } from "@/lib/work/stages";
import { workGroupForCompany } from "@/lib/work/stages";
import { stagePillarLabel } from "@/lib/accounting/types";
import {
  asFinanceFrequency,
  dealTypeLabel,
  formatDealLabel,
  type FinanceFrequency,
} from "@/lib/accounting/finance";
import type { OfferingChip } from "@/lib/offerings/types";
import {
  loadCatalogOfferings,
  loadOfferingsByBdIds,
  loadOfferingsByProjectIds,
  pickDealOfferings,
} from "@/lib/offerings/load";

export type WorkHubRow = {
  companyId: string;
  label: string;
  crmStatus: string | null;
  group: WorkGroup;
  dealValue: number | null;
  dealLabel: string | null;
  dealFrequency: FinanceFrequency;
  dealTypeLabel: string | null;
  pillarLabel: string | null;
  nextAction: string | null;
  projectId: string | null;
  projectTitle: string | null;
  bdRecordId: string | null;
  ownerName: string | null;
  /** Staff assigned via project_team_members (preferred over BD owner). */
  teamNames: string[];
  logoUrl: string | null;
  website: string | null;
  startDate: string | null;
  offerings: OfferingChip[];
};

type Sb = any;

function projectWorkGroup(input: {
  stage: string | null;
  status: string | null;
  bdStage?: string | null;
  hasPublishedSow?: boolean;
}): WorkGroup {
  return workGroupForCompany({
    crmStatus: null,
    bdStages: input.bdStage ? [input.bdStage] : [],
    projectStages: [input.stage || ""],
    projectStatuses: [input.status || ""],
    hasPublishedSow: Boolean(input.hasPublishedSow),
    hasLeadProject:
      input.status !== "expired" &&
      input.status !== "completed" &&
      (input.stage === "lead" || input.status === "pipeline"),
  });
}

function dealMeta(
  dealValue: number | null,
  frequency: FinanceFrequency
): Pick<WorkHubRow, "dealLabel" | "dealFrequency" | "dealTypeLabel"> {
  const dealLabel = formatDealLabel(dealValue, frequency);
  return {
    dealLabel,
    dealFrequency: frequency,
    dealTypeLabel: dealLabel ? dealTypeLabel(frequency) : null,
  };
}

/**
 * Brief work strip for Home: one row per project (title first),
 * company as subtitle. BD-only companies without projects still appear once.
 */
export async function loadWorkHubRows(supabase: Sb): Promise<WorkHubRow[]> {
  const [
    { data: companies },
    { data: bdRows },
    { data: projects },
    { data: sows },
  ] = await Promise.all([
    supabase
      .from("crm_customers")
      .select("id, name, company, status, logo_url, website, archived_at")
      .eq("record_kind", "company")
      .is("archived_at", null)
      .order("company")
      .limit(500),
    supabase
      .from("bd_records")
      .select(
        "id, company_id, stage, next_action_due, next_action_label, owner_id, updated_at, estimate_amount, estimate_frequency, estimate_service, estimate_start_date, owner:profiles!bd_records_owner_id_fkey ( id, full_name )"
      )
      .limit(500),
    supabase
      .from("projects")
      .select(
        "id, client_id, stage, status, deal_value, deal_frequency, title, updated_at, start_date, expected_start_date, bd_record_id"
      )
      .limit(500),
    supabase
      .from("sows")
      .select("id, company_id, status, project_id")
      .not("status", "eq", "archived")
      .limit(500),
  ]);

  const catalog = await loadCatalogOfferings(supabase);
  const projectIds = ((projects || []) as { id: string }[]).map((p) => p.id);
  const bdIds = ((bdRows || []) as { id: string }[]).map((b) => b.id);
  const [byProjectOfferings, byBdOfferings, { data: teamRows }] = await Promise.all([
    loadOfferingsByProjectIds(supabase, projectIds, catalog),
    loadOfferingsByBdIds(supabase, bdIds, catalog),
    projectIds.length
      ? supabase
          .from("project_team_members")
          .select(
            "project_id, is_lead, people:person_id ( full_name )"
          )
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const teamByProject = new Map<string, { name: string; isLead: boolean }[]>();
  for (const row of teamRows || []) {
    const pe = Array.isArray(row.people) ? row.people[0] : row.people;
    const name = (pe?.full_name || "").trim();
    if (!name) continue;
    const list = teamByProject.get(row.project_id) ?? [];
    list.push({ name, isLead: Boolean(row.is_lead) });
    teamByProject.set(row.project_id, list);
  }
  for (const [pid, list] of teamByProject) {
    list.sort((a, b) => {
      if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    teamByProject.set(pid, list);
  }

  const companyById = new Map<string, (typeof companies)[number]>();
  for (const c of companies || []) companyById.set(c.id, c);

  const bdById = new Map<string, (typeof bdRows)[number]>();
  const bdByCompany = new Map<string, typeof bdRows>();
  for (const r of bdRows || []) {
    bdById.set(r.id, r);
    if (!r.company_id) continue;
    const list = bdByCompany.get(r.company_id) ?? [];
    list.push(r);
    bdByCompany.set(r.company_id, list);
  }

  const sowByProject = new Map<string, boolean>();
  const sowByCompany = new Map<string, boolean>();
  for (const s of sows || []) {
    const published = s.status === "published" || s.status === "accepted";
    if (!published) continue;
    if (s.project_id) sowByProject.set(s.project_id, true);
    if (s.company_id) sowByCompany.set(s.company_id, true);
  }

  const rows: WorkHubRow[] = [];
  const companiesWithProjects = new Set<string>();

  for (const p of projects || []) {
    if (!p.client_id) continue;
    const c = companyById.get(p.client_id);
    if (!c) continue;
    companiesWithProjects.add(p.client_id);

    const linkedBd = p.bd_record_id ? bdById.get(p.bd_record_id) : null;

    const group = projectWorkGroup({
      stage: p.stage,
      status: p.status,
      bdStage: linkedBd?.stage,
      hasPublishedSow: sowByProject.get(p.id) || sowByCompany.get(p.client_id),
    });

    const dealValue =
      Number(p.deal_value || 0) > 0
        ? Number(p.deal_value)
        : linkedBd && Number(linkedBd.estimate_amount || 0) > 0
          ? Number(linkedBd.estimate_amount)
          : null;

    const dealFrequency = asFinanceFrequency(
      p.deal_frequency || linkedBd?.estimate_frequency
    );

    const ownerRaw = linkedBd?.owner;
    const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
    const team = teamByProject.get(p.id) || [];
    const teamNames = team.map((t) => t.name);
    const ownerName =
      teamNames.length > 0
        ? teamNames.join(", ")
        : owner?.full_name ?? null;
    const nextBits = [linkedBd?.next_action_label, linkedBd?.next_action_due].filter(
      Boolean
    );
    const companyLabel = c.company || c.name || "Untitled";
    const startDate =
      p.start_date ||
      p.expected_start_date ||
      linkedBd?.estimate_start_date ||
      linkedBd?.next_action_due ||
      null;

    const meta = dealMeta(dealValue, dealFrequency);

    rows.push({
      companyId: c.id,
      label: companyLabel,
      crmStatus: p.stage || c.status,
      group,
      dealValue,
      ...meta,
      pillarLabel: stagePillarLabel(p.stage),
      nextAction: nextBits.length ? nextBits.join(" · ") : null,
      projectId: p.id,
      projectTitle: p.title || "Untitled project",
      bdRecordId: p.bd_record_id ?? null,
      ownerName,
      teamNames,
      logoUrl: c.logo_url || null,
      website: c.website || null,
      startDate,
      offerings: pickDealOfferings(
        p.id,
        p.bd_record_id ?? null,
        byProjectOfferings,
        byBdOfferings
      ),
    });
  }

  // Companies with open BD but no projects yet
  for (const c of companies || []) {
    if (companiesWithProjects.has(c.id)) continue;
    const bds = bdByCompany.get(c.id) ?? [];
    if (!bds.length) continue;
    const activeBd = [...bds].sort(
      (a: { stage: string; updated_at: string }, b: { stage: string; updated_at: string }) => {
        const aLost = a.stage === "archived" || a.stage === "declined" ? 1 : 0;
        const bLost = b.stage === "archived" || b.stage === "declined" ? 1 : 0;
        if (aLost !== bLost) return aLost - bLost;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    )[0];
    const group = workGroupForCompany({
      crmStatus: c.status,
      bdStages: bds.map((b: { stage: string }) => b.stage),
      projectStages: [],
      projectStatuses: [],
      hasPublishedSow: sowByCompany.get(c.id) || false,
      hasLeadProject: false,
    });
    const dealValue =
      Number(activeBd?.estimate_amount || 0) > 0
        ? Number(activeBd.estimate_amount)
        : null;
    const dealFrequency = asFinanceFrequency(activeBd?.estimate_frequency);
    const meta = dealMeta(dealValue, dealFrequency);
    const ownerRaw = activeBd?.owner;
    const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
    const nextBits = [activeBd?.next_action_label, activeBd?.next_action_due].filter(
      Boolean
    );
    rows.push({
      companyId: c.id,
      label: c.company || c.name || "Untitled",
      crmStatus: c.status,
      group,
      dealValue,
      ...meta,
      pillarLabel: null,
      nextAction: nextBits.length ? nextBits.join(" · ") : null,
      projectId: null,
      projectTitle: null,
      bdRecordId: activeBd?.id ?? null,
      ownerName: owner?.full_name ?? null,
      teamNames: [],
      logoUrl: c.logo_url || null,
      website: c.website || null,
      startDate: activeBd?.estimate_start_date || activeBd?.next_action_due || null,
      offerings: pickDealOfferings(
        null,
        activeBd?.id ?? null,
        byProjectOfferings,
        byBdOfferings
      ),
    });
  }

  const rank: Record<WorkGroup, number> = {
    live: 0,
    contract: 1,
    propose: 2,
    qualify: 3,
    find: 4,
    done: 5,
    lose: 6,
  };
  rows.sort((a, b) => {
    const d = rank[a.group] - rank[b.group];
    if (d !== 0) return d;
    if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    const aTitle = a.projectTitle || a.label;
    const bTitle = b.projectTitle || b.label;
    return aTitle.localeCompare(bTitle);
  });
  return rows;
}
