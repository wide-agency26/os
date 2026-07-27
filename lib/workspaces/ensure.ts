import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceLifecycle = "Lead" | "Prospect" | "Active" | "Partner" | "Closed";

function lifecycleFromProspectStatus(status: string): WorkspaceLifecycle {
  switch (status) {
    case "lead":
      return "Lead";
    case "accepted":
      return "Active";
    case "lost":
      return "Closed";
    default:
      return "Prospect";
  }
}

/** Ensure a polymorphic workspace row exists for a client profile. */
export async function ensureWorkspaceForClient(
  supabase: SupabaseClient,
  opts: {
    clientProfileId: string;
    companyName: string;
    lifecycle?: WorkspaceLifecycle;
    tier?: string | null;
  }
): Promise<{ workspaceId: string | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("client_profile_id", opts.clientProfileId)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("profiles")
      .update({ workspace_id: existing.id })
      .eq("id", opts.clientProfileId);
    return { workspaceId: existing.id, error: null };
  }

  const { data: created, error } = await supabase
    .from("workspaces")
    .insert({
      company_name: opts.companyName.trim() || "Client",
      client_profile_id: opts.clientProfileId,
      lifecycle_status: opts.lifecycle ?? "Active",
      current_tier: opts.tier ?? "Growth Program",
      current_phase: 1,
      estimated_value: 0,
      actual_revenue: 0,
    })
    .select("id")
    .single();

  if (error) return { workspaceId: null, error: error.message };

  await supabase
    .from("profiles")
    .update({ workspace_id: created.id })
    .eq("id", opts.clientProfileId);

  await supabase.from("workspace_members").upsert(
    {
      workspace_id: created.id,
      user_id: opts.clientProfileId,
      member_role: "client",
    },
    { onConflict: "workspace_id,user_id" }
  );

  return { workspaceId: created.id, error: null };
}

/** Create workspace row for BD pipeline intake. */
export async function ensureWorkspaceForProspect(
  supabase: SupabaseClient,
  opts: {
    companyName: string;
    status?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    valueAmount?: number;
  }
): Promise<{ workspaceId: string; prospectId: string } | { error: string }> {
  const lifecycle = lifecycleFromProspectStatus(opts.status ?? "lead");

  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({
      company_name: opts.companyName,
      lifecycle_status: lifecycle,
      estimated_value: opts.valueAmount ?? 0,
      current_phase: 1,
    })
    .select("id")
    .single();

  if (wsErr) return { error: wsErr.message };

  return { workspaceId: ws.id, prospectId: ws.id };
}

/**
 * Update a workspace's lifecycle when a prospect status changes.
 * Now operates directly on the workspaces table (prospects table was dropped).
 */
export async function syncWorkspaceLifecycleFromProspect(
  supabase: SupabaseClient,
  workspaceId: string,
  status: string
) {
  await supabase
    .from("workspaces")
    .update({ lifecycle_status: lifecycleFromProspectStatus(status) })
    .eq("id", workspaceId);
}
