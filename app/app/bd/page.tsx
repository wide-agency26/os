import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { BdBoard } from "@/components/bd/BdBoard";
import { listBdRecords } from "@/app/actions/bd";

export default async function BdDashboardPage() {
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
      <Workspace wide>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }

  const result = await listBdRecords();
  if (!result.ok) {
    return (
      <Workspace wide>
        <p className="text-sm text-red-600">{result.error}</p>
      </Workspace>
    );
  }

  return (
    <Workspace wide>
      <BdBoard
        initialRecords={result.records}
        staff={result.staff}
        currentUserId={user.id}
      />
    </Workspace>
  );
}
