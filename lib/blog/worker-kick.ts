import { getSiteUrl } from "@/lib/site-url";

export function blogWorkerSecret(): string | null {
  return process.env.SEO_WORKER_SECRET || process.env.CRON_SECRET || null;
}

export async function kickBlogWorker(jobId: string): Promise<void> {
  const secret = blogWorkerSecret();
  const url = `${getSiteUrl()}/api/blog/worker?job=${encodeURIComponent(jobId)}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* recovered by overnight cron */
  }
}
