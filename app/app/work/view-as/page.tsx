import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { loadWorkHubRows } from "@/lib/work/load-hub";
import { ViewAsClientPicker } from "@/components/work/ViewAsClientPicker";
import { loadViewAsCatalog } from "@/app/actions/view-as-client";

export default async function ViewAsClientPage() {
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
    return (
      <Workspace>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }

  const rows = await loadWorkHubRows(supabase);
  const clients = rows
    .filter((r) => r.group === "live" || r.crmStatus === "Client")
    .map((r) => ({
      id: r.companyId,
      name: r.label,
      logoUrl: r.logoUrl,
      website: r.website,
      projectTitle: r.projectTitle,
    }));

  const catalog = await loadViewAsCatalog(clients);
  return <ViewAsClientPicker clients={catalog} />;
}
