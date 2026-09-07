"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  deleteResourceCostRow,
  upsertResourceCostRow,
  type ResourceCostInput,
} from "@/lib/hr/resource-cost";
import {
  syncHrAndOverheadLedger,
  syncProjectAssignmentCosts,
} from "@/lib/accounting/sync";

function revalidateCostSurfaces(projectIds: string[]) {
  revalidatePath("/app/resources");
  revalidatePath("/app/hr");
  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/actual");
  revalidatePath("/app/accounting/identified");
  revalidatePath("/app/accounting/unidentified");
  for (const id of projectIds) {
    revalidatePath(`/app/projects/${id}/cost`);
    revalidatePath(`/app/projects/${id}`);
  }
}

async function syncLedgers(projectIds: string[]) {
  const hr = await syncHrAndOverheadLedger();
  if (!hr.ok) return { ok: false as const, error: hr.error || "HR ledger sync failed" };
  for (const projectId of projectIds) {
    const proj = await syncProjectAssignmentCosts(projectId);
    if (!proj.ok) return { ok: false as const, error: proj.error || "Project ledger sync failed" };
  }
  return { ok: true as const };
}

export async function saveResourceCost(input: ResourceCostInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const saved = await upsertResourceCostRow(supabase, input, user?.id || null);
  if (!saved.ok) return saved;

  const sync = await syncLedgers(saved.projectIds);
  if (!sync.ok) return sync;

  revalidateCostSurfaces(saved.projectIds);
  return { ok: true as const, id: saved.id };
}

export async function deleteResourceCost(id: string) {
  const supabase = await createClient();
  const deleted = await deleteResourceCostRow(supabase, id);
  if (!deleted.ok) return deleted;

  const sync = await syncLedgers(deleted.projectIds);
  if (!sync.ok) return sync;

  revalidateCostSurfaces(deleted.projectIds);
  return { ok: true as const };
}
