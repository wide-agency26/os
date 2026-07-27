"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { generateJsonFromGateway, hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { createClient } from "@/utils/supabase/server";

export type AiHqState = { error?: string; success?: string };

export async function submitAiHqPrompt(
  _prev: AiHqState,
  formData: FormData
): Promise<AiHqState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Founder access required." };

  const prompt = String(formData.get("prompt") ?? "").trim();
  const workspaceId = String(formData.get("workspace_id") ?? "").trim() || null;
  if (!prompt) return { error: "Enter a command." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let resultJson: Record<string, unknown> = {
    summary: "Draft queued — approve to execute against the target workspace.",
    tasks: [],
  };

  if (hasGatewayCredentials()) {
    try {
      const parsed = await generateJsonFromGateway({
        system:
          "You are WIDE OS operations AI. Return JSON: { summary: string, tasks: [{ title, owner, due }] }. is_draft is always true until a human approves.",
        prompt,
        maxOutputTokens: 2000,
      });
      if (parsed && typeof parsed === "object") resultJson = parsed as Record<string, unknown>;
    } catch (e) {
      resultJson.summary = e instanceof Error ? e.message : "AI draft failed";
    }
  }

  const { error } = await supabase.from("ai_hq_jobs").insert({
    workspace_id: workspaceId,
    prompt,
    result_json: resultJson,
    is_draft: true,
    status: "queued",
    created_by: user?.id ?? null,
  });

  if (error) {
    if ((error as { code?: string }).code === "42P01") {
      return { error: "Run migration 20250101000016_destructive_workspace_reset.sql first." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/ai-hq");
  return { success: "Draft queued with neon badge — approve to execute." };
}

export async function approveAiHqJobAction(formData: FormData): Promise<void> {
  await approveAiHqJobForm({}, formData);
}

export async function approveAiHqJobForm(
  _prev: AiHqState,
  formData: FormData
): Promise<AiHqState> {
  const jobId = String(formData.get("job_id") ?? "").trim();
  if (!jobId) return { error: "Missing job." };
  return approveAiHqJob(jobId);
}

export async function approveAiHqJob(jobId: string): Promise<AiHqState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Founder access required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_hq_jobs")
    .update({ is_draft: false, status: "approved" })
    .eq("id", jobId);

  if (error) return { error: error.message };
  revalidatePath("/admin/ai-hq");
  return { success: "Approved — execution unlocked for this draft." };
}
