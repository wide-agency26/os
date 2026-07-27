import type { SupabaseClient } from "@supabase/supabase-js";
import { parseInvestmentAmount } from "@/lib/finance/parse-investment";

export type FinanceProspectRow = {
  id: string;
  company_name: string;
  status: string;
  updated_at: string;
  investment: unknown;
  is_published: boolean;
  proposal_title: string | null;
};

export type FinanceProjectRow = {
  id: string;
  title: string;
  status: string;
  client_id: string;
  end_date: string | null;
  client_label: string;
};

export type FinanceSnapshot = {
  prospects: FinanceProspectRow[];
  projects: FinanceProjectRow[];
  totals: {
    identifiedPipeline: number;
    bookedRevenue: number;
    activeProjects: number;
    openProspects: number;
  };
};

function tableMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || /does not exist/i.test(err.message ?? "");
}

async function loadFromWorkspaces(supabase: SupabaseClient): Promise<FinanceSnapshot | null> {
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, company_name, lifecycle_status, estimated_value, updated_at")
    .in("lifecycle_status", ["Lead", "Prospect"])
    .order("updated_at", { ascending: false });

  if (error && tableMissing(error)) return null;
  if (error) throw new Error(error.message);

  const prospects: FinanceProspectRow[] = (workspaces ?? []).map((w) => ({
    id: w.id,
    company_name: w.company_name,
    status: w.lifecycle_status === "Lead" ? "lead" : "prospect",
    updated_at: w.updated_at,
    investment: { amount: w.estimated_value },
    is_published: false,
    proposal_title: null,
  }));

  let identifiedPipeline = 0;
  let openProspects = 0;
  for (const p of prospects) {
    const amt = parseInvestmentAmount(p.investment);
    if (amt) identifiedPipeline += amt;
    openProspects += 1;
  }

  return {
    prospects,
    projects: [],
    totals: {
      identifiedPipeline,
      bookedRevenue: 0,
      activeProjects: 0,
      openProspects,
    },
  };
}

export async function loadFinanceSnapshot(
  supabase: SupabaseClient
): Promise<{ data: FinanceSnapshot | null; error: string | null }> {
  const [prospectsRes, proposalsRes, projectsRes, clientsRes] = await Promise.all([
    supabase
      .from("prospects")
      .select("id, company_name, status, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("prospect_proposals").select("prospect_id, title, investment, is_published"),
    supabase
      .from("projects")
      .select("id, title, status, client_id, end_date")
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, company_name")
      .eq("role", "client"),
  ]);

  if (tableMissing(prospectsRes.error)) {
    try {
      const ws = await loadFromWorkspaces(supabase);
      if (ws) return { data: ws, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Failed to load workspaces." };
    }
  }

  if (prospectsRes.error) return { data: null, error: prospectsRes.error.message };
  if (proposalsRes.error && !tableMissing(proposalsRes.error)) {
    return { data: null, error: proposalsRes.error.message };
  }
  if (projectsRes.error && !tableMissing(projectsRes.error)) {
    return { data: null, error: projectsRes.error.message };
  }

  const proposalByProspect = new Map(
    (proposalsRes.data ?? []).map((row) => [row.prospect_id, row])
  );

  const clientLabel = new Map<string, string>();
  for (const c of clientsRes.data ?? []) {
    clientLabel.set(c.id, c.company_name?.trim() || c.full_name?.trim() || "Client");
  }

  const prospects: FinanceProspectRow[] = (prospectsRes.data ?? []).map((p) => {
    const proposal = proposalByProspect.get(p.id);
    return {
      id: p.id,
      company_name: p.company_name,
      status: p.status,
      updated_at: p.updated_at,
      investment: proposal?.investment ?? null,
      is_published: proposal?.is_published ?? false,
      proposal_title: proposal?.title ?? null,
    };
  });

  const projects: FinanceProjectRow[] = (projectsRes.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    client_id: p.client_id,
    end_date: p.end_date,
    client_label: clientLabel.get(p.client_id) ?? "Client",
  }));

  const pipelineStatuses = new Set(["lead", "qualified", "proposal", "prospect", "final_nego", "agreement"]);
  let identifiedPipeline = 0;
  let bookedRevenue = 0;
  let openProspects = 0;

  for (const p of prospects) {
    const amt = parseInvestmentAmount(p.investment);
    if (pipelineStatuses.has(p.status) && amt) identifiedPipeline += amt;
    if ((p.status === "won" || p.status === "accepted") && amt) bookedRevenue += amt;
    if (pipelineStatuses.has(p.status)) openProspects += 1;
  }

  return {
    data: {
      prospects,
      projects,
      totals: {
        identifiedPipeline,
        bookedRevenue,
        activeProjects: projects.filter((p) => p.status === "running").length,
        openProspects,
      },
    },
    error: null,
  };
}
