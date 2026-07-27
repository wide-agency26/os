import { ClientDashboardContent } from "@/app/components/dashboard/ClientDashboardContent";
import type { WideAccess } from "@/lib/wide-os/types";
import { createClient } from "@/utils/supabase/server";
import { touchLastPortalVisit } from "@/app/actions/portal-activity";

export async function ClientDashboardView({ access }: { access: WideAccess }) {
  const clientId = access.clientId!;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", clientId)
    .maybeSingle();

  if (access.privilege === "read" && access.role === "client") {
    await touchLastPortalVisit();
  }

  return (
    <ClientDashboardContent
      workspaceClientId={clientId}
      greetingName={profile?.full_name}
    />
  );
}
