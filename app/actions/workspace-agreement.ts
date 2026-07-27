"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type AgreementState = { error?: string; success?: string };

export async function signProspectAgreementForm(formData: FormData): Promise<void> {
  await signProspectAgreement({}, formData);
}

export async function signProspectAgreement(
  _prev: AgreementState,
  formData: FormData
): Promise<AgreementState> {
  const workspaceId = String(formData.get("workspace_id") ?? "").trim();
  if (!workspaceId) return { error: "Missing workspace." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { error } = await supabase
    .from("workspaces")
    .update({
      agreement_signed_at: new Date().toISOString(),
      agreement_signed_by: user.id,
    })
    .eq("id", workspaceId);

  if (error) return { error: error.message };

  revalidatePath(`/prospect/${workspaceId}/agreement`);
  revalidatePath(`/prospect/${workspaceId}/proposal`);
  return {
    success: "Agreement signed — workspace is now Active at Phase 1. Client access provisions automatically.",
  };
}
