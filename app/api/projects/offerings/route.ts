import { NextRequest, NextResponse } from "next/server";
import { getDealOfferings } from "@/app/actions/offerings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const bdRecordId = req.nextUrl.searchParams.get("bdRecordId");
  const data = await getDealOfferings({
    projectId: projectId || null,
    bdRecordId: bdRecordId || null,
  });
  return NextResponse.json(data);
}
