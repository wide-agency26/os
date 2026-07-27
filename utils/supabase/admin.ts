import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

/**
 * Service-role client: server-only. Bypasses RLS — use only in trusted server actions.
 * Requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in env.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
