/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { ensureBlogSettings, mapArticle } from "@/lib/blog/load";
import { syncLiveBlogCorpus } from "@/lib/blog/scrape-live";
import { blogWorkerSecret } from "@/lib/blog/worker-kick";

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

/** Scrape live blog indexes (DE/EN) and mark matching drafts as published. */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient() as any;
  const { data: settingsRows } = await supabase
    .from("blog_settings")
    .select("*")
    .not("site_url", "is", null)
    .limit(12);

  const results: { projectId: string; liveCount: number; matched: number }[] = [];
  for (const row of settingsRows || []) {
    const settings = await ensureBlogSettings(supabase, row.project_id);
    if (!settings.site_url) continue;
    const { data: articles } = await supabase.from("blog_articles").select("*").eq("project_id", row.project_id);
    const synced = await syncLiveBlogCorpus(
      supabase,
      row.project_id,
      settings,
      (articles || []).map(mapArticle)
    );
    results.push({ projectId: row.project_id, ...synced });
  }

  return NextResponse.json({ ok: true, results });
}
