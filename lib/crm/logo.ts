/** Suggested mark size: 128×128 square (favicon or uploaded logo). */

export const COMPANY_LOGO_SIZE = 128;

export function hostnameFromWebsite(
  website: string | null | undefined
): string | null {
  const raw = (website || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function faviconUrlForHost(
  host: string,
  size = COMPANY_LOGO_SIZE
): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

export function companyMarkSrc(input: {
  logoUrl?: string | null;
  website?: string | null;
}): string | null {
  if (input.logoUrl?.trim()) return input.logoUrl.trim();
  const host = hostnameFromWebsite(input.website);
  if (!host) return null;
  return faviconUrlForHost(host);
}
