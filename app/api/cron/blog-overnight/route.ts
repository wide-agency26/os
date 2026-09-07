/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { enqueueOvernightJob } from "@/lib/blog/kick";
import { kickBlogWorker, blogWorkerSecret } from "@/lib/blog/worker-kick";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = blogWorkerSecret();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer === secret || new URL(req.url).searchParams.get("secret") === secret;
}

/**
 * Overnight Blog Builder sweep. 05:15 UTC — after SEO sweeper.
 * Only projects with blog_settings.enabled run, and at most 5 per night.
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient() as any;
  const { data: settings } = await supabase
    .from("blog_settings")
    .select("project_id")
    .eq("enabled", true)
    .limit(5);

  const started: string[] = [];
  for (const row of settings || []) {
    const jobId = await enqueueOvernightJob(row.project_id);
    started.push(jobId);
    await kickBlogWorker(jobId);
  }

  return NextResponse.json({ ok: true, jobs: started });
}
