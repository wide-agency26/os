import { createClient } from "@/utils/supabase/server";
import {
  isAgencyStaff,
  isClientManager,
  isSuperadmin,
  normalizeRole,
} from "@/lib/rbac";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, profile: null, ok: false as const };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile, ok: true as const };
}

/** Superadmin (legacy `admin` included). */
export async function requireSuperadmin() {
  const gate = await requireUser();
  if (!gate.ok || !isSuperadmin(gate.profile?.role)) {
    return { ...gate, ok: false as const };
  }
  return { ...gate, ok: true as const };
}

/** @deprecated Use requireSuperadmin — kept for existing server actions. */
export const requireAdmin = requireSuperadmin;

/** Superadmin or assigned client manager. */
export async function requireAgencyStaff() {
  const gate = await requireUser();
  if (!gate.ok || !isAgencyStaff(gate.profile?.role)) {
    return { ...gate, ok: false as const };
  }
  return { ...gate, ok: true as const };
}

export async function requireClientManager() {
  const gate = await requireUser();
  if (!gate.ok || !isClientManager(gate.profile?.role)) {
    return { ...gate, ok: false as const };
  }
  return { ...gate, ok: true as const };
}

export function profileRole(profile: { role?: string | null } | null) {
  return normalizeRole(profile?.role);
}
