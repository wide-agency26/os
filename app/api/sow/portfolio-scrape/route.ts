import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { scrapeWideProjectPage } from "@/lib/sow/portfolio-scrape";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
  }

  const result = await scrapeWideProjectPage(body.url);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
