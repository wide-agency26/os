import type { SupabaseClient } from "@supabase/supabase-js";

/** Workspace owner user id (team members share the primary account's data). */
export async function getWorkspaceClientId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("primary_account_id")
    .eq("id", userId)
    .maybeSingle();

  const primary = data?.primary_account_id;
  if (primary && typeof primary === "string") return primary;
  return userId;
}
