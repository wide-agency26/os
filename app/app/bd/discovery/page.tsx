import { redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { OpportunityFinderClient } from "@/components/bd/OpportunityFinderClient";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";

export default async function OpportunityFinderPage() {
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
        <p className="text-red-600 font-medium">Access denied.</p>
      </Workspace>
    );
  }

  return (
    <Workspace wide>
      <OpportunityFinderClient />
    </Workspace>
  );
}
