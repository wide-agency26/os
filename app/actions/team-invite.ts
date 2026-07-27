"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/utils/supabase/server";
import { getWorkspaceClientId } from "@/lib/workspace";

export type TeamInviteState = { error?: string; success?: string };

export async function inviteTeamMember(
  _prev: TeamInviteState,
  formData: FormData
): Promise<TeamInviteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client") {
    return { error: "Only client workspaces can invite teammates from here." };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  if (!email || !full_name) {
    return { error: "Email and name are required." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return { error: `${msg} Add SUPABASE_SERVICE_ROLE_KEY for invitations.` };
  }

  const workspaceOwnerId = await getWorkspaceClientId(supabase, user.id);
  const site = getSiteUrl();
  const next = encodeURIComponent("/dashboard");
  const redirectTo = `${site}/auth/callback?next=${next}`;

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name,
      primary_account_id: workspaceOwnerId,
    },
    redirectTo,
  });

  if (inviteError) {
    return { error: inviteError.message };
  }

  revalidatePath("/settings");
  return {
    success: `Invitation sent to ${email}. They’ll share your workspace (Brand Hub, files, projects).`,
  };
}
