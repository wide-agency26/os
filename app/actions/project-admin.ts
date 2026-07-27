"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";

export type ProjectAdminState = { error?: string; success?: string };

export async function updateProjectEngagement(
  _prev: ProjectAdminState,
  formData: FormData
): Promise<ProjectAdminState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Admin only." };

  const projectId = String(formData.get("project_id") ?? "").trim();
  if (!projectId) return { error: "Missing project." };

  const contract_renews_at = String(formData.get("contract_renews_at") ?? "").trim() || null;
  const launch_date = String(formData.get("launch_date") ?? "").trim() || null;
  const lead_raw = String(formData.get("lead_admin_id") ?? "").trim();
  const lead_admin_id = lead_raw ? lead_raw : null;
  const next_action_label = String(formData.get("next_action_label") ?? "").trim() || null;
  const next_action_cta_label = String(formData.get("next_action_cta_label") ?? "").trim() || null;
  const next_action_href = String(formData.get("next_action_href") ?? "").trim() || null;
  const milestones_json = String(formData.get("milestones_json") ?? "").trim();

  let milestones: unknown = null;
  if (milestones_json) {
    try {
      milestones = JSON.parse(milestones_json);
      if (!Array.isArray(milestones)) {
        return { error: "Milestones JSON must be an array." };
      }
    } catch {
      return { error: "Invalid milestones JSON." };
    }
  }

  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    contract_renews_at,
    launch_date,
    lead_admin_id,
    next_action_label,
    next_action_cta_label,
    next_action_href,
    updated_at: new Date().toISOString(),
  };
  if (milestones !== null) patch.milestones = milestones;

  const { error } = await supabase.from("projects").update(patch as any).eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/cm/roster");
  revalidatePath("/cm/roster");
  revalidatePath("/dashboard");
  return { success: "Project updated." };
}
