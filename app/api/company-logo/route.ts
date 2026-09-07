import { NextResponse } from "next/server";
import { uploadCompanyLogo } from "@/app/actions/company-logo";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const companyId = String(form.get("companyId") || "").trim();
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }
    const res = await uploadCompanyLogo(companyId, form);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
