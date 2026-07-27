import { WideOsChrome } from "@/components/wide-os/shells/WideOsChrome";
import type { DepartmentId, WideAccess } from "@/lib/wide-os/types";
import { createClient } from "@/utils/supabase/server";
import { getWideOsSidebarContext } from "@/lib/wide-os/sidebar-context";

export async function DepartmentShell({
  department,
  access,
  children,
}: {
  department: DepartmentId;
  access: WideAccess;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const sidebar = await getWideOsSidebarContext();

  return (
    <WideOsChrome
      zone={department}
      userName={profile?.full_name ?? department}
      userEmail={user?.email ?? ""}
      isSuperadmin={sidebar.isSuperadmin}
    >
      {children}
    </WideOsChrome>
  );
}
