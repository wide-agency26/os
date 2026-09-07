import { NextResponse } from "next/server";
import { importBlogCorpus } from "@/app/actions/blog-builder";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const projectId = String(form.get("projectId") || "").trim();
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "Missing project" }, { status: 400 });
    }
    const res = await importBlogCorpus(projectId, form);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
