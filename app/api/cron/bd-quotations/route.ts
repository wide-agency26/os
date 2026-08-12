import { NextResponse } from "next/server";
import {
  pollLexwareQuotationStatuses,
  runQuotationNoEngagementAlerts,
} from "@/app/actions/quotation";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET || process.env.BD_CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = new URL(req.url);
  const q = url.searchParams.get("secret") || "";
  return bearer === secret || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const [poll, alerts] = await Promise.all([
    pollLexwareQuotationStatuses(),
    runQuotationNoEngagementAlerts(),
  ]);
  return NextResponse.json({ ok: true, poll, alerts });
}

export async function POST(req: Request) {
  return GET(req);
}
