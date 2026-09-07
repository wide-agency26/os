import { NextRequest, NextResponse } from "next/server";
import { loadCompanyPortalContext } from "@/app/actions/company-members";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() || "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const data = await loadCompanyPortalContext(companyId);
  if (data.error) {
    return NextResponse.json(data, { status: 400 });
  }
  return NextResponse.json(data);
}
