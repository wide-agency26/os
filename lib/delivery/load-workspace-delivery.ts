import type { SupabaseClient } from "@supabase/supabase-js";
import { computeProjectProfitability, resourceCostForBilling } from "@/lib/delivery/profitability";

export type DeliveryTask = {
  id: string;
  phase_id: string;
  task_name: string;
  assigned_person_id: string | null;
  assignee_name: string | null;
  assignee_hourly_rate: number;
  assigned_resource_id: string | null;
  resource_name: string | null;
  resource_billing_type: string | null;
  resource_cost_amount: number;
  duration_hours: number;
  task_type: "Deliverable" | "Contract" | "Internal Milestone";
  needs_client_confirmation: boolean;
  confirmation_deadline: string | null;
  is_confirmed: boolean;
  description: string | null;
};

export type DeliveryPhase = {
  id: string;
  phase_order: number;
  phase_title: string;
  is_completed: boolean;
  tasks: DeliveryTask[];
};

export type WorkspaceDeliverySnapshot = {
  phases: DeliveryPhase[];
  people: { id: string; name: string; hourly_rate_cost: number }[];
  resources: { id: string; resource_name: string; billing_type: string; cost_amount: number }[];
  profitability: ReturnType<typeof computeProjectProfitability>;
  needsMigration: boolean;
  overdueClientTasks: number;
};

export async function loadWorkspaceDelivery(
  supabase: SupabaseClient,
  workspaceId: string,
  contractValue: number
): Promise<{ data: WorkspaceDeliverySnapshot | null; error: string | null }> {
  await supabase.rpc("ensure_workspace_phases", { p_workspace_id: workspaceId });

  const { data: phases, error: phaseErr } = await supabase
    .from("project_phases")
    .select("id, phase_order, phase_title, is_completed")
    .eq("workspace_id", workspaceId)
    .order("phase_order");

  if (phaseErr?.code === "42P01") {
    return {
      data: {
        phases: [],
        people: [],
        resources: [],
        profitability: computeProjectProfitability(contractValue, []),
        needsMigration: true,
        overdueClientTasks: 0,
      },
      error: null,
    };
  }
  if (phaseErr) return { data: null, error: phaseErr.message };

  const phaseIds = (phases ?? []).map((p) => p.id as string);
  let taskRows: Record<string, unknown>[] = [];
  if (phaseIds.length) {
    const { data: tasks, error: taskErr } = await supabase
      .from("tasks")
      .select(
        "id, phase_id, task_name, assigned_person_id, assigned_resource_id, duration_hours, task_type, needs_client_confirmation, confirmation_deadline, is_confirmed, description"
      )
      .in("phase_id", phaseIds)
      .order("created_at");
    if (taskErr) return { data: null, error: taskErr.message };
    taskRows = (tasks ?? []) as Record<string, unknown>[];
  }

  const personIds = [...new Set(taskRows.map((t) => t.assigned_person_id as string).filter(Boolean))];
  const resourceIds = [...new Set(taskRows.map((t) => t.assigned_resource_id as string).filter(Boolean))];

  const peopleMap = new Map<string, { name: string; rate: number }>();
  const resourceMap = new Map<string, { name: string; billing: string; cost: number }>();

  if (personIds.length) {
    const { data: people } = await supabase
      .from("people")
      .select("id, full_name, name, hourly_rate_cost")
      .in("id", personIds);
    for (const p of people ?? []) {
      peopleMap.set(p.id as string, {
        name: (p.name as string) || (p.full_name as string),
        rate: Number(p.hourly_rate_cost ?? 0),
      });
    }
  }
  if (resourceIds.length) {
    const { data: res } = await supabase.from("resources").select("id, resource_name, billing_type, cost_amount").in("id", resourceIds);
    for (const r of res ?? []) {
      resourceMap.set(r.id as string, {
        name: r.resource_name as string,
        billing: r.billing_type as string,
        cost: Number(r.cost_amount ?? 0),
      });
    }
  }

  const { data: allPeople } = await supabase
    .from("people")
    .select("id, full_name, name, hourly_rate_cost")
    .order("full_name");
  const { data: allResources } = await supabase
    .from("resources")
    .select("id, resource_name, billing_type, cost_amount")
    .order("resource_name");

  const deliveryTasks: DeliveryTask[] = taskRows.map((t) => {
    const pid = t.assigned_person_id as string | null;
    const rid = t.assigned_resource_id as string | null;
    const person = pid ? peopleMap.get(pid) : null;
    const resource = rid ? resourceMap.get(rid) : null;
    return {
      id: t.id as string,
      phase_id: t.phase_id as string,
      task_name: t.task_name as string,
      assigned_person_id: pid,
      assignee_name: person?.name ?? null,
      assignee_hourly_rate: person?.rate ?? 0,
      assigned_resource_id: rid,
      resource_name: resource?.name ?? null,
      resource_billing_type: resource?.billing ?? null,
      resource_cost_amount: resource?.cost ?? 0,
      duration_hours: Number(t.duration_hours ?? 0),
      task_type: t.task_type as DeliveryTask["task_type"],
      needs_client_confirmation: Boolean(t.needs_client_confirmation),
      confirmation_deadline: (t.confirmation_deadline as string) ?? null,
      is_confirmed: Boolean(t.is_confirmed),
      description: (t.description as string) ?? null,
    };
  });

  const phasesOut: DeliveryPhase[] = (phases ?? []).map((p) => ({
    id: p.id as string,
    phase_order: p.phase_order as number,
    phase_title: p.phase_title as string,
    is_completed: Boolean(p.is_completed),
    tasks: deliveryTasks.filter((t) => t.phase_id === p.id),
  }));

  const costInputs = deliveryTasks.map((t) => ({
    duration_hours: t.duration_hours,
    assignee_hourly_rate: t.assignee_hourly_rate,
    resource_cost: resourceCostForBilling(
      t.resource_billing_type ?? "Per_Project_Pass_Through",
      t.resource_cost_amount,
      t.duration_hours
    ),
  }));

  const now = Date.now();
  const overdueClientTasks = deliveryTasks.filter(
    (t) =>
      t.needs_client_confirmation &&
      !t.is_confirmed &&
      t.confirmation_deadline &&
      new Date(t.confirmation_deadline).getTime() < now
  ).length;

  return {
    data: {
      phases: phasesOut,
      people: (allPeople ?? []).map((p) => ({
        id: p.id as string,
        name: (p.name as string) || (p.full_name as string),
        hourly_rate_cost: Number(p.hourly_rate_cost ?? 0),
      })),
      resources: (allResources ?? []).map((r) => ({
        id: r.id as string,
        resource_name: r.resource_name as string,
        billing_type: r.billing_type as string,
        cost_amount: Number(r.cost_amount ?? 0),
      })),
      profitability: computeProjectProfitability(contractValue, costInputs),
      needsMigration: false,
      overdueClientTasks,
    },
    error: null,
  };
}
