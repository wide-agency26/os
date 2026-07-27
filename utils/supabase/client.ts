import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";
import type { Database } from "@/types/supabase";

export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabasePublishableKey());
}
