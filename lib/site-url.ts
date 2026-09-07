/** Canonical production origin. No trailing slash. */
export const CANONICAL_ORIGIN = "https://os.wide-communication.com";

const LEGACY_PRODUCTION_HOSTS = new Set([
  "os-bice-nine.vercel.app",
  "os-wide-agency26s-projects.vercel.app",
]);

export function isLegacyProductionHost(host: string | null): boolean {
  if (!host) return false;
  return LEGACY_PRODUCTION_HOSTS.has(host.split(":")[0].toLowerCase());
}

/** Base URL for auth redirects (invite email, OAuth). No trailing slash. */
export function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  if (process.env.VERCEL_ENV === "production") return CANONICAL_ORIGIN;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

