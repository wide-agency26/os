"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";

export type AnnouncementState = { error?: string; success?: string };

export async function createGlobalAnnouncement(
  _prev: AnnouncementState,
  formData: FormData
): Promise<AnnouncementState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Admin only." };

  const body = String(formData.get("body") ?? "").trim();
  const ends_raw = String(formData.get("ends_at") ?? "").trim();

  if (!body) return { error: "Message is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("global_announcements").insert({
    body,
    ends_at: ends_raw ? new Date(ends_raw).toISOString() : null,
    is_active: true,
    created_by: gate.user!.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard");
  revalidatePath("/admin/dashboard");
  return { success: "Announcement is live for all signed-in clients." };
}

export async function deactivateAnnouncement(id: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Admin only." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("global_announcements")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
