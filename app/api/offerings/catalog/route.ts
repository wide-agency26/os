import { NextResponse } from "next/server";
import { listCatalogOfferings } from "@/app/actions/offerings";

export const runtime = "nodejs";

export async function GET() {
  const data = await listCatalogOfferings();
  return NextResponse.json(data);
}
