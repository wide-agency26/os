import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSuperadmin } from "@/lib/rbac";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isSuperadmin(profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("profiles")
    .select("id, full_name, company_name")
    .eq("role", "client")
    .order("company_name", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = (rows ?? []).map((r) => ({
    id: r.id,
    label: r.company_name?.trim() || r.full_name?.trim() || "Client",
    company: r.company_name?.trim() || null,
  }));

  return NextResponse.json({ clients });
}
