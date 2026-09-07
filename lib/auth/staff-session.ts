import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";

export type StaffSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string } | null;
  profile: { role: string | null; full_name: string | null } | null;
  isStaff: boolean;
};

/**
 * One auth + profile read per request. Layout and pages that call this
 * share the same round-trip via React.cache().
 */
export const getStaffSession = cache(async (): Promise<StaffSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, profile: null, isStaff: false };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  return {
    supabase,
    user: { id: user.id },
    profile: profile
      ? { role: profile.role ?? null, full_name: profile.full_name ?? null }
      : null,
    isStaff: Boolean(profile?.role && isFounder(profile.role)),
  };
});

/** Redirects unauthenticated users to login. Caller still checks isStaff. */
export async function requireStaffPage(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session.user) redirect("/login");
  return session;
}
