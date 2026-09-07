import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ConnectionsHub } from "@/components/settings/ConnectionsHub";
import { loadIntegrationHub } from "@/lib/integrations/status";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
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
        <p className="text-[13px] text-text-secondary">Founders only.</p>
      </Workspace>
    );
  }

  const { items } = await loadIntegrationHub();

  return (
    <Workspace wide>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Settings
        </p>
        <h1 className="text-2xl font-semibold text-text-primary mt-1">Connections</h1>
        <p className="text-[13px] text-text-secondary mt-1 max-w-2xl">
          Every API gateway the OS uses or still needs. Per-project binds stay on{" "}
          <Link href="/app/projects/report-data" className="text-text-primary hover:underline">
            Report Sources
          </Link>
          ; inbound mail aliases stay on{" "}
          <Link href="/app/settings/integrations" className="text-text-primary hover:underline">
            Inbound email
          </Link>
          .
        </p>
      </div>
      <ConnectionsHub items={items} />
    </Workspace>
  );
}
