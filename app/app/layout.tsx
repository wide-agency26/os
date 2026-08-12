import { ReactNode } from "react";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { AppShell } from "@/components/frappe-ui/AppShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const pathname =
    headerList.get("x-pathname") ||
    headerList.get("x-invoke-path") ||
    headerList.get("next-url") ||
    "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? null;
    fullName = profile?.full_name ?? null;
  }

  const isStaff = Boolean(role && isFounder(role));

  return (
    <AppShell
      isStaff={isStaff}
      role={role}
      displayName={fullName || "Admin User"}
      initialPathname={pathname}
    >
      {children}
    </AppShell>
  );
}
