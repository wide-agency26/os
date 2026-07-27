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

  const [{ data: clients }, { data: prospects }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, company_name")
      .eq("role", "client")
      .order("company_name", { ascending: true }),
    supabase
      .from("prospects")
      .select("id, company_name, contact_name, status")
      .order("company_name", { ascending: true }),
  ]);

  return NextResponse.json({
    clients: (clients ?? []).map((c) => ({
      id: c.id,
      label: c.company_name?.trim() || c.full_name?.trim() || "Client",
    })),
    prospects: (prospects ?? []).map((p) => ({
      id: p.id,
      label: `${p.company_name}${p.contact_name ? ` · ${p.contact_name}` : ""} (${p.status})`,
    })),
  });
}
