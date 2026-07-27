import { ExecutiveAuthProvider } from "@/components/wide-os/providers/ExecutiveAuthProvider";
import { WideOsChrome } from "@/components/wide-os/shells/WideOsChrome";
import { DatabaseSetupBanner } from "@/app/components/admin/DatabaseSetupBanner";
import type { WideAccess } from "@/lib/wide-os/types";
import { createClient } from "@/utils/supabase/server";
import { getWideOsSidebarContext } from "@/lib/wide-os/sidebar-context";

export async function ExecutiveShell({
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
  const sidebar = await getWideOsSidebarContext();

  return (
    <ExecutiveAuthProvider access={access}>
      <WideOsChrome
        zone="executive"
        userName={user?.email?.split("@")[0] ?? "Executive"}
        userEmail={user?.email ?? ""}
        isSuperadmin={sidebar.isSuperadmin}
        banner={<DatabaseSetupBanner />}
      >
        {children}
      </WideOsChrome>
    </ExecutiveAuthProvider>
  );
}
