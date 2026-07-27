import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { homePathForRole } from "@/lib/routing";
import { getWorkspaceClientId } from "@/lib/workspace";
import { previewHomePath } from "@/lib/preview-mode";
import { readPreviewContext } from "@/lib/preview-mode.server";
import { isSuperadmin } from "@/lib/rbac";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, prospect_id")
    .eq("id", user.id)
    .single();

  const workspaceId = await getWorkspaceClientId(supabase, user.id);
  if (isSuperadmin(profile?.role)) {
    const preview = await readPreviewContext();
    if (preview) redirect(previewHomePath(preview));
  }

  redirect(
    homePathForRole(
      profile?.role,
      workspaceId,
      (profile?.prospect_id as string | null) ?? undefined
    )
  );
}
