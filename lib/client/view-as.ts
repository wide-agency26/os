/** Cookie used when a founder is previewing the client portal as one company. */
export const VIEW_AS_COMPANY_COOKIE = "wide_view_as_company";

/** Optional CRM contact the founder is impersonating inside that company. */
export const VIEW_AS_CONTACT_COOKIE = "wide_view_as_contact";

/** Optional staff path to return to after exiting a CI / portal preview. */
export const VIEW_AS_RETURN_COOKIE = "wide_view_as_return";

export function safeViewAsReturnPath(raw?: string | null): string | null {
  const value = String(raw || "").trim();
  if (!value.startsWith("/app/")) return null;
  if (value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
