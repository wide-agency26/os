import { NextResponse } from "next/server";
import { listFounderInbox } from "@/app/actions/founder-notifications";

export const runtime = "nodejs";

export async function GET() {
  const data = await listFounderInbox();
  return NextResponse.json(data);
}
