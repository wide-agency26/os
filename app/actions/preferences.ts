"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type PrefsState = { error?: string; success?: string };

export async function saveNotificationPreferences(
  _prev: PrefsState,
  formData: FormData
): Promise<PrefsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const notify_email = formData.get("notify_email") === "on";
  const notify_sms = formData.get("notify_sms") === "on";
  const notify_in_app = formData.get("notify_in_app") === "on";

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      notify_email,
      notify_sms,
      notify_in_app,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/admin/settings");
  return { success: "Preferences saved." };
}
