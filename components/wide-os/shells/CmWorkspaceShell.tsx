import Link from "next/link";
import { WorkspaceAccessProvider } from "@/components/wide-os/providers/WorkspaceAccessProvider";
import { WideOsChrome } from "@/components/wide-os/shells/WideOsChrome";
import type { WideAccess } from "@/lib/wide-os/types";
import { adminPaths } from "@/lib/wide-os/paths";
import { createClient } from "@/utils/supabase/server";
import { getWideOsSidebarContext } from "@/lib/wide-os/sidebar-context";

export async function CmWorkspaceShell({
  access,
  children,
}: {
  access: WideAccess;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clientId = access.clientId!;
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", clientId)
    .maybeSingle();

  const label =
    clientProfile?.company_name?.trim() ||
    clientProfile?.full_name?.trim() ||
    "Client";

  const banner =
    access.executive ? (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        <p className="text-text-secondary">
          CM workspace · <span className="font-medium text-text-primary">{label}</span> (executive)
        </p>
        <Link href={adminPaths.dashboard()} className="text-accent font-medium hover:underline">
          ← Command center
        </Link>
      </div>
    ) : (
      <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
        Writing here updates the client portal at{" "}
        <code className="text-text-primary">/client/{clientId}</code> (read-only for clients).
      </div>
    );

  const sidebar = await getWideOsSidebarContext();

  return (
    <WorkspaceAccessProvider access={access}>
      <WideOsChrome
        zone="cm"
        clientId={clientId}
        userName={user?.email?.split("@")[0] ?? "CM"}
        userEmail={user?.email ?? ""}
        isSuperadmin={sidebar.isSuperadmin}
        banner={banner}
      >
        {children}
      </WideOsChrome>
    </WorkspaceAccessProvider>
  );
}
