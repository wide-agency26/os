import { getSiteUrl } from "@/lib/site-url";

export function workerSecret(): string | null {
  return process.env.SEO_WORKER_SECRET || process.env.CRON_SECRET || null;
}

/**
 * Hands a run off to the background worker. Fire-and-forget: we only wait for
 * the request to be accepted, never for the audit itself. A handoff that fails
 * (cold start, transient network) is picked up by the sweeper cron instead, so
 * this never needs to throw.
 */
export async function kickWorker(runId: string): Promise<void> {
  const secret = workerSecret();
  const url = `${getSiteUrl()}/api/seo/worker?run=${encodeURIComponent(runId)}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* recovered by /api/cron/seo-sweeper */
  }
}
