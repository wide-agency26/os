import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/utils/supabase/server";
type KickoffPhaseId = string;

export type WorkspaceRecord = {
  id: string;
  company_name: string;
  lifecycle_status: string;
  current_phase: number;
  phase_3_signed_at: string | null;
  client_profile_id: string | null;
  estimated_value: number;
  actual_revenue: number;
};

function phaseIdFromNumber(n: number): KickoffPhaseId {
  return "phase-1-discovery";
}

export async function getWorkspaceForClient(
  clientOrWorkspaceId: string
): Promise<WorkspaceRecord | null> {
  noStore();
  const supabase = await createClient();

  const { data: byProfile } = await supabase
    .from("workspaces")
    .select(
      "id, company_name, lifecycle_status, current_phase, phase_3_signed_at, client_profile_id, estimated_value, actual_revenue"
    )
    .eq("client_profile_id", clientOrWorkspaceId)
    .maybeSingle();

  if (byProfile) return byProfile as WorkspaceRecord;

  const { data: byId } = await supabase
    .from("workspaces")
    .select(
      "id, company_name, lifecycle_status, current_phase, phase_3_signed_at, client_profile_id, estimated_value, actual_revenue"
    )
    .eq("id", clientOrWorkspaceId)
    .maybeSingle();

  return (byId as WorkspaceRecord | null) ?? null;
}

export function kickoffPhaseFromWorkspace(ws: WorkspaceRecord | null): KickoffPhaseId {
  if (!ws) return "phase-1-discovery";
  return phaseIdFromNumber(ws.current_phase);
}

export function isKickoffPhaseHardLocked(
  phase: KickoffPhaseId,
  ws: WorkspaceRecord | null
): boolean {
  return false;
}
