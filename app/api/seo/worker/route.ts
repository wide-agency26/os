import { after } from "next/server";
import { NextResponse } from "next/server";
import { HEARTBEAT_STALE_MS, MAX_RUN_ATTEMPTS } from "@/lib/seo/constants";
import { kickWorker } from "@/lib/seo/kick";
import { runSlice } from "@/lib/seo/runner";
import { logRunEvent, seoAdmin } from "@/lib/seo/store";

/**
 * Background worker for a single audit run.
 *
 * Each invocation claims the run, works for roughly 210 seconds, persists its
 * resume cursor, then re-invokes itself if the run is not finished. This gives
 * unbounded total runtime on top of a 300s function limit without needing a
 * queue service.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.SEO_WORKER_SECRET || process.env.CRON_SECRET;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = new URL(req.url);
  return bearer === secret || url.searchParams.get("secret") === secret;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const runId = new URL(req.url).searchParams.get("run");
  if (!runId) {
    return NextResponse.json({ ok: false, error: "Missing run id" }, { status: 400 });
  }

  const supabase = seoAdmin();

  // Optimistic claim: only proceed if the run is queued, or running with a
  // heartbeat old enough that the previous worker is certainly gone. This is
  // what stops two workers processing the same run concurrently.
  const staleBefore = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();
  const { data: claimed } = await supabase
    .from("seo_runs")
    .update({
      status: "running",
      heartbeat_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["queued", "running"])
    .or(`heartbeat_at.is.null,heartbeat_at.lt.${staleBefore},status.eq.queued`)
    .select("id, attempt")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: "already running or finished" });
  }

  const attempt = ((claimed as { attempt: number }).attempt ?? 0) + 1;
  if (attempt > MAX_RUN_ATTEMPTS) {
    await supabase
      .from("seo_runs")
      .update({
        status: "failed",
        error_message: `Gave up after ${MAX_RUN_ATTEMPTS} attempts`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    await logRunEvent(supabase, runId, null, "Run abandoned after too many restarts", "error");
    return NextResponse.json({ ok: false, error: "Too many attempts" });
  }

  await supabase.from("seo_runs").update({ attempt }).eq("id", runId);

  const outcome = await runSlice(runId);

  // A slice that returned is a slice that did not crash, so the restart budget
  // resets. Only consecutive deaths mid-slice accumulate towards the cap —
  // otherwise a large crawl would be killed simply for needing many slices.
  await supabase.from("seo_runs").update({ attempt: 0 }).eq("id", runId);

  if (!outcome.done) {
    after(() => kickWorker(runId));
  }

  return NextResponse.json({ ok: true, ...outcome });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
