/** PostgREST / Supabase errors when public tables are missing from API schema cache. */
export function isMissingPublicTableError(message: string | undefined, code?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (m.includes("schema cache")) return true;
  if (m.includes("could not find the table")) return true;
  if (code === "PGRST205" || code === "42P01") return true;
  return false;
}

export function friendlyDbSetupMessage(raw: string | undefined): string {
  return (
    raw ??
    "Database query failed. If tables are new, run supabase/FULL_SETUP.sql in the Supabase SQL Editor."
  );
}
