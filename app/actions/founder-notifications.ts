"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { resolveExecutiveAccess } from "@/lib/wide-os/resolve-access";

export type FounderNotificationRow = {
  id: string;
  workspace_id: string | null;
  title: string;
  message: string;
  severity_level: "Info" | "Success" | "Warning" | "Critical";
  created_at: string;
};

export async function listFounderNotifications(): Promise<{
  notifications: FounderNotificationRow[];
  error?: string;
}> {
  const access = await resolveExecutiveAccess();
  if (!access.executive) return { notifications: [], error: "Founder access required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("founder_notifications")
    .select("id, workspace_id, title, message, severity_level, created_at")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    if (error.code === "42P01") return { notifications: [] };
    return { notifications: [], error: error.message };
  }

  return { notifications: (data ?? []) as FounderNotificationRow[] };
}

export async function resolveFounderNotification(notificationId: string): Promise<{ error?: string }> {
  const access = await resolveExecutiveAccess();
  if (!access.executive) return { error: "Founder access required." };

  const supabase = await createClient();
  const { error } = await supabase.from("founder_notifications").delete().eq("id", notificationId);

  if (error) {
    if (error.code === "42P01") return { error: "Notification center not migrated yet." };
    return { error: error.message };
  }

  revalidatePath("/admin");
  return {};
}

export async function createFounderNotification(input: {
  title: string;
  message: string;
  severity_level?: FounderNotificationRow["severity_level"];
  workspace_id?: string | null;
}): Promise<{ error?: string }> {
  const access = await resolveExecutiveAccess();
  if (!access.executive) return { error: "Founder access required." };

  const supabase = await createClient();
  const { error } = await supabase.from("founder_notifications").insert({
    title: input.title,
    message: input.message,
    severity_level: input.severity_level ?? "Info",
    workspace_id: input.workspace_id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}
