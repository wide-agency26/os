import { NextRequest, NextResponse } from "next/server";
import {
  getLatestContextDigest,
  listContextEntries,
} from "@/app/actions/context-bank";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() || "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const projectId = req.nextUrl.searchParams.get("projectId");
  const entryType = req.nextUrl.searchParams.get("entryType");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";

  const [list, digest] = await Promise.all([
    listContextEntries({
      companyId,
      projectId: projectId || null,
      entryType: entryType || null,
      from,
      to,
      includeInactive,
    }),
    getLatestContextDigest({
      companyId,
      projectId: projectId || null,
    }),
  ]);

  return NextResponse.json({ list, digest });
}
