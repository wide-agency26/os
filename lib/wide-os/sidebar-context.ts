import { createClient } from "@/utils/supabase/server";
import { isSuperadmin } from "@/lib/rbac";
export type WideOsSidebarContext = {
  isSuperadmin: boolean;
};

export async function getWideOsSidebarContext(): Promise<WideOsSidebarContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isSuperadmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { isSuperadmin: isSuperadmin(profile?.role) };
}
