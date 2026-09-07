import { NextResponse } from "next/server";
import { HEARTBEAT_STALE_MS, MAX_RUN_ATTEMPTS } from "@/lib/seo/constants";
import { kickWorker } from "@/lib/seo/kick";
import { logRunEvent, seoAdmin } from "@/lib/seo/store";

/**
 * Safety net for the self-chaining worker.
 *
 * The worker normally re-invokes itself, so this only matters when a function
 * died mid-slice or a handoff request was dropped. It requeues runs whose
 * heartbeat has gone stale and fails the ones that have exhausted their
 * attempts, so a broken run surfaces as failed rather than hanging forever.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET || process.env.SEO_WORKER_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = new URL(req.url);
  return bearer === secret || url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = seoAdmin();
  const staleBefore = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();

  const { data, error } = await supabase
    .from("seo_runs")
    .select("id, attempt, status, heartbeat_at")
    .in("status", ["queued", "running"])
    .or(`heartbeat_at.is.null,heartbeat_at.lt.${staleBefore}`)
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const runs = (data ?? []) as { id: string; attempt: number }[];
  const resumed: string[] = [];
  const abandoned: string[] = [];

  for (const run of runs) {
    if ((run.attempt ?? 0) >= MAX_RUN_ATTEMPTS) {
      await supabase
        .from("seo_runs")
        .update({
          status: "failed",
          error_message: `Stalled and gave up after ${MAX_RUN_ATTEMPTS} attempts`,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      await logRunEvent(supabase, run.id, null, "Run abandoned after repeated stalls", "error");
      abandoned.push(run.id);
      continue;
    }

    await logRunEvent(supabase, run.id, null, "Resuming stalled run", "warn");
    await kickWorker(run.id);
    resumed.push(run.id);
  }

  return NextResponse.json({ ok: true, resumed, abandoned });
}

export async function POST(req: Request) {
  return GET(req);
}
