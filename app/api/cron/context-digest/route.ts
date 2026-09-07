import { NextResponse } from "next/server";
import { generateContextDigests } from "@/lib/context-bank/digest";

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
  const result = await generateContextDigests();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
