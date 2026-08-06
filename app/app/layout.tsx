"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/frappe-ui/Sidebar";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { Awesomebar } from "@/components/frappe-ui/Awesomebar";
import {
  SuperadminClientPreviewBanner,
  isClientFacingAppPath,
} from "@/components/client/SuperadminClientPreviewBanner";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";

function isClientGuidelineDetail(pathname: string) {
  return (
    pathname.startsWith("/app/client-guidelines/") &&
    pathname !== "/app/client-guidelines"
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const staffPreviewingClient = Boolean(isStaff && isClientFacingAppPath(pathname));
  // Client chrome for real clients, and for staff previewing client surfaces
  const useClientChrome = isStaff === false || staffPreviewingClient;
  const hideChrome = useClientChrome && isClientGuidelineDetail(pathname);

  useEffect(() => {
    async function checkRole() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setIsStaff(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        setIsStaff(Boolean(profile && isFounder(profile.role)));
      } catch {
        setIsStaff(false);
      }
    }
    void checkRole();
  }, []);

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {isStaff === null ? (
        <div className="w-[72px] bg-[#F9FAFB] border-r border-[#E5E7EB] h-screen animate-pulse" />
      ) : useClientChrome ? (
        <ClientSidebar />
      ) : (
        <Sidebar />
      )}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {staffPreviewingClient && <SuperadminClientPreviewBanner />}
        {!hideChrome && (
          <Awesomebar
            title={useClientChrome ? "WIDE Client Portal" : "WIDE OS Workspace"}
          />
        )}
        <div
          className={`flex-1 min-h-0 ${
            hideChrome ? "overflow-hidden flex flex-col" : "overflow-auto"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
