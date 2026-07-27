import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";
import type { Database } from "@/types/supabase";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
            // Set cache-control headers to prevent CDN caching of auth responses
            if (headers) {
              Object.entries(headers).forEach(([key, value]) => {
                // Headers can only be set on the response in Route Handlers and Server Actions.
                // In Server Components, cookie.set will throw a warning but won't break.
              });
            }
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have proxy refreshing user sessions.
          }
        },
      },
    }
  );
}
