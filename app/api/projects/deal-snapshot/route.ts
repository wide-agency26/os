import { NextRequest, NextResponse } from "next/server";
import { loadProjectDealSnapshot } from "@/app/actions/projects-commercial";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId")?.trim() || "";
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
  }
  const data = await loadProjectDealSnapshot(projectId);
  return NextResponse.json(data);
}
