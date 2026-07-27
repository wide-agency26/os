"use client";

import Sidebar from "@/app/components/Sidebar";
import type { WideZone } from "@/lib/wide-os/types";
import type { SidebarPortalRole } from "@/lib/routing";
export function WideOsChrome({
  zone,
  clientId,
  userName,
  userEmail,
  children,
  banner,
  isSuperadmin = false,
}: {
  zone: WideZone;
  clientId?: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
  banner?: React.ReactNode;
  isSuperadmin?: boolean;
}) {
  const portalRole: SidebarPortalRole =
    zone === "executive" ? "superadmin" : zone === "cm" ? "client_manager" : "client";

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        portalRole={portalRole}
        clientId={clientId}
        userName={userName}
        userEmail={userEmail}
        wideZone={zone}
        isSuperadmin={isSuperadmin}
      />
      <main className="flex min-h-0 flex-1 min-w-0 flex-col overflow-y-auto bg-background text-foreground">
        <div className="shrink-0 lg:hidden h-14" aria-hidden="true" />
        <div className="flex-1 p-6 lg:p-8">
          {banner}
          {children}
        </div>
      </main>
    </div>
  );
}
