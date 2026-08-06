"use client";

import { createClient } from "@/utils/supabase/client";

/** Fully clear the session and hard-navigate to login (works for admin + client). */
export async function performSignOut() {
  const supabase = createClient();
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      /* continue to login anyway */
    }
  }
  window.location.assign("/login");
}
