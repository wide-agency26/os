import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectionsClient } from "@/components/accounting/ProjectionsClient";
import { loadProjectionBoard } from "@/lib/accounting/load-projections";

export default async function AccountingProjectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    redirect("/app/home");
  }

  const board = await loadProjectionBoard(supabase);

  return (
    <Workspace wide>
      <ProjectionsClient board={board} />
    </Workspace>
  );
}
