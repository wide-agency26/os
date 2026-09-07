import { NextRequest, NextResponse } from "next/server";
import { getSowBuilderData } from "@/app/actions/sow";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sowId = req.nextUrl.searchParams.get("sowId")?.trim() || "";
  if (!sowId) {
    return NextResponse.json({ ok: false, error: "sowId required" }, { status: 400 });
  }
  const data = await getSowBuilderData(sowId);
  return NextResponse.json(data);
}
