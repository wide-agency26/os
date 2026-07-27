import { createClient } from "@/utils/supabase/server";
import { isSuperadmin } from "@/lib/rbac";

export async function GlobalAnnouncementBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (isSuperadmin(profile?.role)) return null;

  const { data: rows } = await supabase
    .from("global_announcements")
    .select("body")
    .order("created_at", { ascending: false })
    .limit(1);

  const body = rows?.[0]?.body;
  if (!body) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-text-primary"
    >
      <span className="font-semibold text-accent">WIDE · </span>
      {body}
    </div>
  );
}
