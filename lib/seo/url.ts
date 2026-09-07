import { SKIP_EXTENSIONS } from "./constants";

export function normalizeSiteUrl(raw: string): string {
  let u = raw.trim();
  if (!u) throw new Error("URL is required");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const parsed = new URL(u);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported");
  }
  parsed.hash = "";
  return parsed.toString();
}

export function domainOf(rawUrl: string): string {
  return new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
}

/**
 * Canonical form used for de-duplication: drops the hash, strips tracking
 * params, normalises the trailing slash and lowercases the host. Two URLs that
 * normalise to the same string are treated as the same page.
 */
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "ref", "_ga",
]);

export function canonicalizeUrl(rawUrl: string, base?: string): string | null {
  try {
    const parsed = base ? new URL(rawUrl, base) : new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();

    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    parsed.searchParams.sort();

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    if (!parsed.pathname) parsed.pathname = "/";

    return parsed.toString();
  } catch {
    return null;
  }
}

/** Treats apex and www as the same site, which is what users expect. */
export function isSameSite(candidate: string, siteUrl: string): boolean {
  try {
    return domainOf(candidate) === domainOf(siteUrl);
  } catch {
    return false;
  }
}

export function hasSkippedExtension(rawUrl: string): boolean {
  try {
    const path = new URL(rawUrl).pathname.toLowerCase();
    return SKIP_EXTENSIONS.some((ext) => path.endsWith(ext));
  } catch {
    return false;
  }
}

export function pathOf(rawUrl: string): string {
  try {
    const p = new URL(rawUrl);
    return `${p.pathname}${p.search}` || "/";
  } catch {
    return rawUrl;
  }
}

export function originOf(rawUrl: string): string {
  return new URL(rawUrl).origin;
}

export function slugifySeoPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * A crude template signature (`/blog/:slug`, `/products/:slug/:slug`) used to
 * pick a representative sample of pages for PageSpeed rather than testing
 * twenty near-identical blog posts.
 */
export function templateSignature(rawUrl: string): string {
  try {
    const segments = new URL(rawUrl).pathname.split("/").filter(Boolean);
    if (!segments.length) return "/";
    return (
      "/" +
      segments
        .map((seg) =>
          /^\d+$/.test(seg) || seg.length > 24 || /\d{4,}/.test(seg) ? ":slug" : seg
        )
        .join("/")
    );
  } catch {
    return rawUrl;
  }
}
