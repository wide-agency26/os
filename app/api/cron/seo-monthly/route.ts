import { NextResponse } from "next/server";
import type { Json } from "@/types/supabase";
import { kickWorker } from "@/lib/seo/kick";
import { mergeOptions, seoAdmin } from "@/lib/seo/store";
import { slugifySeoPart } from "@/lib/seo/url";

/**
 * Monthly re-audit for sites flagged `monthly_rerun`.
 *
 * A single audit is a snapshot; the value compounds once there is a previous
 * run to compare against, which is what drives the score deltas in the UI.
 * Runs daily and picks up whatever has aged past 30 days, so a missed day
 * self-corrects.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const RERUN_AFTER_DAYS = 30;
const MAX_PER_SWEEP = 5;

function authorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET || process.env.SEO_WORKER_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer === secret || new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = seoAdmin();
  const cutoff = new Date(Date.now() - RERUN_AFTER_DAYS * 86400_000).toISOString();

  const { data, error } = await supabase
    .from("seo_sites")
    .select("id, domain, url, default_options, last_run_at")
    .eq("monthly_rerun", true)
    .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
    .limit(MAX_PER_SWEEP);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const sites = (data ?? []) as {
    id: string;
    domain: string;
    default_options: Json;
  }[];

  const started: string[] = [];

  for (const site of sites) {
    // Skip sites that already have a run in flight.
    const { data: active } = await supabase
      .from("seo_runs")
      .select("id")
      .eq("site_id", site.id)
      .in("status", ["queued", "running"])
      .limit(1)
      .maybeSingle();
    if (active) continue;

    const options = mergeOptions(site.default_options);
    const slug = `${slugifySeoPart(site.domain)}-${Date.now().toString(36).slice(-6)}`;

    const { data: run } = await supabase
      .from("seo_runs")
      .insert({
        site_id: site.id,
        public_slug: slug,
        status: "queued",
        phase: "discover",
        options: options as unknown as Json,
      })
      .select("id")
      .single();

    if (!run) continue;

    const runId = (run as { id: string }).id;
    await supabase.from("seo_run_events").insert({
      run_id: runId,
      phase: "discover",
      level: "info",
      message: `Scheduled monthly re-audit queued for ${site.domain}`,
      meta: {} as Json,
    });

    await kickWorker(runId);
    started.push(site.domain);
  }

  return NextResponse.json({ ok: true, started });
}

export async function POST(req: Request) {
  return GET(req);
}
