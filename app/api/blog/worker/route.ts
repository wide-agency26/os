import { after } from "next/server";
import { NextResponse } from "next/server";
import { runJobSlice } from "@/lib/blog/kick";
import { kickBlogWorker, blogWorkerSecret } from "@/lib/blog/worker-kick";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = blogWorkerSecret();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer === secret || new URL(req.url).searchParams.get("secret") === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const jobId = new URL(req.url).searchParams.get("job");
  if (!jobId) return NextResponse.json({ ok: false, error: "Missing job" }, { status: 400 });

  const outcome = await runJobSlice(jobId);
  if (!outcome.done) after(() => kickBlogWorker(jobId));
  return NextResponse.json({ ok: true, ...outcome });
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}
