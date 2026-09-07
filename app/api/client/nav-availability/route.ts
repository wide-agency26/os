import { NextResponse } from "next/server";
import { getClientNavState } from "@/app/actions/client-nav";

export const runtime = "nodejs";

export async function GET() {
  const data = await getClientNavState();
  return NextResponse.json(data);
}
