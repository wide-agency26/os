/** Normalize pasted URLs to https and validate. */

export function normalizeVaultExternalUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withScheme);
    if (u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export function inferGoogleProvider(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "drive.google.com") return "google_drive";
    if (host === "docs.google.com") return "google_docs";
    if (host === "sheets.google.com") return "google_sheets";
    if (host === "slides.google.com") return "google_slides";
    return null;
  } catch {
    return null;
  }
}

export function defaultLinkFileName(url: string, displayName?: string | null): string {
  const dn = displayName?.trim();
  if (dn) return dn;
  const p = inferGoogleProvider(url);
  if (p === "google_drive") return "Google Drive";
  if (p === "google_docs") return "Google Doc";
  if (p === "google_sheets") return "Google Sheet";
  if (p === "google_slides") return "Google Slides";
  return "External link";
}
