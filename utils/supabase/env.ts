/**
 * Resolve Supabase env vars — supports current dashboard names and legacy aliases.
 *
 * Dashboard / Supabase CLI often provides:
 * - NEXT_PUBLIC_SUPABASE (project URL)
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (browser-safe key; replaces legacy "anon")
 *
 * Legacy (still supported):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

function trim(s: string | undefined): string | undefined {
  return s?.trim() || undefined;
}

export function getSupabaseUrl(): string {
  const url = trim(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? trim(process.env.NEXT_PUBLIC_SUPABASE);
  if (!url) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE or NEXT_PUBLIC_SUPABASE_URL (e.g. https://xxxx.supabase.co)."
    );
  }
  return url;
}

/** Publishable / anon key for browser and server user-scoped clients. */
export function getSupabasePublishableKey(): string {
  const key =
    trim(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!key) {
    throw new Error(
      "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return key;
}

/** Service role / secret key — server-only, never NEXT_PUBLIC_. */
export function getSupabaseSecretKey(): string {
  const key =
    trim(process.env.SUPABASE_SERVICE_ROLE_KEY) ?? trim(process.env.SUPABASE_SECRET_KEY);
  if (!key) {
    throw new Error(
      "Missing Supabase secret key. Set SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role)."
    );
  }
  return key;
}
