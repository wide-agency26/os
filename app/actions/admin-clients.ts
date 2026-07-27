"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import { adminPaths } from "@/lib/wide-os/paths";

export type AdminClientState = {
  error?: string;
  success?: string;
};

export async function createWorkspace(
  _prev: AdminClientState,
  formData: FormData
): Promise<AdminClientState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const company_name = String(formData.get("company_name") ?? "").trim();
  const current_tier = String(formData.get("current_tier") ?? "Lead");
  const lifecycle_status = String(formData.get("lifecycle_status") ?? "Lead");
  const estimated_value = parseFloat(String(formData.get("estimated_value") ?? "0"));
  const contact_name = String(formData.get("contact_name") ?? "").trim();

  if (!company_name) return { error: "Company name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").insert({
    company_name,
    current_tier,
    lifecycle_status,
    estimated_value: Number.isFinite(estimated_value) ? estimated_value : 0,
    contact_name: contact_name || null,
  });

  if (error) return { error: error.message };

  revalidatePath(adminPaths.clients());
  return { success: "Client workspace created." };
}

export async function deleteWorkspace(id: string): Promise<AdminClientState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(adminPaths.clients());
  return { success: "Client workspace deleted." };
}
