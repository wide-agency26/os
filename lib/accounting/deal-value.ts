import { computeSowValueFromRows } from "@/lib/sow/constants";
import { sowFamilyKey } from "@/lib/sow/version";
import { contractTotal, mergeContract } from "@/lib/bd/contract";
import { pillarFromStage, type LedgerPillar } from "@/lib/accounting/types";
import { syncProjectRevenue } from "@/lib/accounting/sync";
import { pruneCrmUnidentifiedForCompany } from "@/lib/accounting/sync-crm";

type Sb = any;

export type DealValueSource =
  | "contract_confirmed"
  | "contract_draft"
  | "sow_family_min"
  | "sow_draft"
  | "manual"
  | "none";

export type SowVersionValue = {
  id: string;
  title: string;
  status: string;
  version_number: number;
  net: number;
};

export type SowPricedLine = {
  title: string;
  description: string;
  price: number;
};

export type DealFinanceSnapshot = {
  projectId: string;
  amount: number | null;
  source: DealValueSource;
  pillar: LedgerPillar;
  contractConfirmed: boolean;
  sowConfirmed: boolean;
  versionCount: number;
  versions: SowVersionValue[];
  startDate: string | null;
  bdRecordId: string | null;
  sowFamilyId: string | null;
  companyId: string | null;
};

function sowNetFromMaps(
  sowId: string,
  groupsBySow: Map<string, { price: number | null }[]>,
  itemsBySow: Map<string, { price: number | null; cost_group_id: string | null }[]>
): number {
  return computeSowValueFromRows({
    groups: groupsBySow.get(sowId) ?? [],
    items: itemsBySow.get(sowId) ?? [],
  });
}

export async function loadSowNets(
  supabase: Sb,
  sowIds: string[]
): Promise<Map<string, number>> {
  const nets = new Map<string, number>();
  if (sowIds.length === 0) return nets;
  const [{ data: groups }, { data: items }] = await Promise.all([
    supabase
      .from("sow_cost_groups")
      .select("sow_id, price")
      .in("sow_id", sowIds),
    supabase
      .from("sow_line_items")
      .select("sow_id, price, cost_group_id")
      .in("sow_id", sowIds),
  ]);
  const groupsBySow = new Map<string, { price: number | null }[]>();
  const itemsBySow = new Map<
    string,
    { price: number | null; cost_group_id: string | null }[]
  >();
  for (const g of groups || []) {
    const list = groupsBySow.get(g.sow_id) ?? [];
    list.push({ price: g.price });
    groupsBySow.set(g.sow_id, list);
  }
  for (const i of items || []) {
    const list = itemsBySow.get(i.sow_id) ?? [];
    list.push({ price: i.price, cost_group_id: i.cost_group_id });
    itemsBySow.set(i.sow_id, list);
  }
  for (const id of sowIds) {
    nets.set(id, sowNetFromMaps(id, groupsBySow, itemsBySow));
  }
  return nets;
}

/** Cost groups + ungrouped lines — same no-double-count rule as SOW net. */
export async function loadSowPricedLines(
  supabase: Sb,
  sowId: string
): Promise<SowPricedLine[]> {
  const [{ data: groups }, { data: items }] = await Promise.all([
    supabase
      .from("sow_cost_groups")
      .select("id, title, price, sort_order")
      .eq("sow_id", sowId)
      .order("sort_order"),
    supabase
      .from("sow_line_items")
      .select("title, description, price, cost_group_id, sort_order")
      .eq("sow_id", sowId)
      .order("sort_order"),
  ]);
  const lines: SowPricedLine[] = [];
  for (const g of groups || []) {
    if (g.price == null) continue;
    lines.push({
      title: g.title || "Package",
      description: "Leistungen gemäß Scope of Work.",
      price: Number(g.price),
    });
  }
  for (const i of items || []) {
    if (i.cost_group_id) continue;
    if (i.price == null) continue;
    lines.push({
      title: i.title,
      description: i.description || "Leistungen gemäß Scope of Work.",
      price: Number(i.price),
    });
  }
  return lines;
}

export function pickFamilyAmount(versions: SowVersionValue[]): {
  amount: number | null;
  source: Extract<DealValueSource, "sow_family_min" | "sow_draft" | "none">;
} {
  const sent = versions.filter(
    (v) =>
      (v.status === "published" || v.status === "accepted") && v.net > 0
  );
  if (sent.length > 0) {
    return {
      amount: Math.min(...sent.map((v) => v.net)),
      source: "sow_family_min",
    };
  }
  const drafts = [...versions].sort(
    (a, b) => b.version_number - a.version_number
  );
  const latest = drafts.find((v) => v.net > 0);
  if (latest) return { amount: latest.net, source: "sow_draft" };
  return { amount: null, source: "none" };
}

export async function resolveProjectDealValue(
  supabase: Sb,
  projectId: string
): Promise<DealFinanceSnapshot | null> {
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, stage, deal_value, expected_start_date, start_date, client_id, bd_record_id, sow_family_id, contract_confirmed_at, status"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  let sowsQuery = supabase
    .from("sows")
    .select("id, title, status, version_number, version_root_id, project_id")
    .eq("project_id", projectId);
  const { data: byProject } = await sowsQuery;
  let family = (byProject || []) as {
    id: string;
    title: string;
    status: string;
    version_number: number | null;
    version_root_id: string | null;
    project_id: string | null;
  }[];

  const familyRoot =
    project.sow_family_id ||
    (family[0] ? sowFamilyKey(family[0]) : null);
  if (familyRoot) {
    const { data: extra } = await supabase
      .from("sows")
      .select("id, title, status, version_number, version_root_id, project_id")
      .or(`id.eq.${familyRoot},version_root_id.eq.${familyRoot}`);
    const seen = new Set(family.map((s) => s.id));
    for (const row of extra || []) {
      if (!seen.has(row.id)) family.push(row);
    }
  }

  const nets = await loadSowNets(
    supabase,
    family.map((s) => s.id)
  );
  const versions: SowVersionValue[] = family
    .map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      version_number: s.version_number ?? 1,
      net: nets.get(s.id) ?? 0,
    }))
    .sort((a, b) => a.version_number - b.version_number);

  let contractAmount: number | null = null;
  if (project.bd_record_id) {
    const { data: rec } = await supabase
      .from("bd_records")
      .select("contract")
      .eq("id", project.bd_record_id)
      .maybeSingle();
    const contract = mergeContract(
      (rec?.contract as Record<string, unknown>) || {}
    );
    const total = contractTotal(contract.line_items);
    if (total > 0) contractAmount = total;
  }

  const sowPick = pickFamilyAmount(versions);
  const sowConfirmed = versions.some((v) => v.status === "accepted");
  const contractConfirmed = Boolean(project.contract_confirmed_at);

  let amount: number | null = null;
  let source: DealValueSource = "none";
  if (contractConfirmed && contractAmount != null) {
    amount = contractAmount;
    source = "contract_confirmed";
  } else if (contractAmount != null) {
    amount = contractAmount;
    source = "contract_draft";
  } else {
    amount = sowPick.amount;
    source = sowPick.source;
  }

  const manualValue = Number(project.deal_value || 0);
  if ((amount == null || amount === 0) && manualValue > 0) {
    amount = manualValue;
    source = "manual";
  }

  return {
    projectId,
    amount,
    source,
    pillar: pillarFromStage(project.stage),
    contractConfirmed,
    sowConfirmed,
    versionCount: versions.length,
    versions,
    startDate: project.start_date || project.expected_start_date || null,
    bdRecordId: project.bd_record_id || null,
    sowFamilyId: familyRoot,
    companyId: project.client_id || null,
  };
}

export async function applyProjectDealValue(projectId: string): Promise<{
  ok: boolean;
  error?: string;
  snapshot?: DealFinanceSnapshot;
}> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = (await createClient()) as Sb;
  const snapshot = await resolveProjectDealValue(supabase, projectId);
  if (!snapshot) return { ok: false, error: "Project not found" };

  const { data: project } = await supabase
    .from("projects")
    .select("contract_confirmed_at, deal_value")
    .eq("id", projectId)
    .maybeSingle();

  if (project?.contract_confirmed_at && snapshot.source !== "contract_confirmed") {
    const sync = await syncProjectRevenue(projectId);
    if (snapshot.companyId) await pruneCrmUnidentifiedForCompany(snapshot.companyId);
    return { ok: sync.ok, error: sync.error, snapshot };
  }

  const nextValue = snapshot.amount;
  const current = Number(project?.deal_value || 0);
  if (nextValue == null && current > 0) {
    /* Keep a manually entered deal value when SOW/contract have no price yet. */
  } else if (current !== Number(nextValue || 0)) {
    const { error } = await supabase
      .from("projects")
      .update({
        deal_value: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (error) return { ok: false, error: error.message };
  }

  const sync = await syncProjectRevenue(projectId);
  if (snapshot.companyId) await pruneCrmUnidentifiedForCompany(snapshot.companyId);
  return { ok: sync.ok, error: sync.error, snapshot };
}

export async function applySowDealValue(sowId: string): Promise<{
  ok: boolean;
  error?: string;
  projectId?: string;
}> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = (await createClient()) as Sb;
  const { data: sow } = await supabase
    .from("sows")
    .select("id, project_id, version_root_id")
    .eq("id", sowId)
    .maybeSingle();
  if (!sow) return { ok: false, error: "SOW not found" };
  let projectId = sow.project_id as string | null;
  if (!projectId) {
    const root = sow.version_root_id || sow.id;
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("sow_family_id", root)
      .maybeSingle();
    projectId = proj?.id ?? null;
  }
  if (!projectId) return { ok: true };
  const res = await applyProjectDealValue(projectId);
  return { ok: res.ok, error: res.error, projectId };
}
