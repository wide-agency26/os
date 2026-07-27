import Link from "next/link";
import { WorkspaceAccessProvider } from "@/components/wide-os/providers/WorkspaceAccessProvider";
import { WideOsChrome } from "@/components/wide-os/shells/WideOsChrome";
import { GlobalAnnouncementBanner } from "@/app/components/GlobalAnnouncementBanner";
import type { WideAccess } from "@/lib/wide-os/types";
import { adminPaths } from "@/lib/wide-os/paths";
import { createClient } from "@/utils/supabase/server";
import { getWideOsSidebarContext } from "@/lib/wide-os/sidebar-context";

export async function ClientPortalShell({
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
    "Client workspace";

  const banner = (
    <>
      {access.executive ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <p className="text-text-secondary">
            Client view · <span className="font-medium text-text-primary">{label}</span>
          </p>
          <Link href={adminPaths.clients()} className="text-[#00FF00] font-medium hover:underline">
            ← Client roster
          </Link>
        </div>
      ) : null}
      <GlobalAnnouncementBanner />
    </>
  );

  const sidebar = await getWideOsSidebarContext();

  return (
    <WorkspaceAccessProvider access={access}>
      <WideOsChrome
        zone="client"
        clientId={clientId}
        userName={user?.email?.split("@")[0] ?? "Client"}
        userEmail={user?.email ?? ""}
        isSuperadmin={sidebar.isSuperadmin}
        banner={banner}
      >
        {children}
      </WideOsChrome>
    </WorkspaceAccessProvider>
  );
}
