"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/frappe-ui/Sidebar";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { Awesomebar } from "@/components/frappe-ui/Awesomebar";
import {
  SuperadminClientPreviewBanner,
  isClientFacingAppPath,
} from "@/components/client/SuperadminClientPreviewBanner";

function isClientGuidelineDetail(pathname: string) {
  return (
    pathname.startsWith("/app/client-guidelines/") &&
    pathname !== "/app/client-guidelines"
  );
}

function isClientSowReadingSurface(pathname: string) {
  return (
    (pathname.startsWith("/app/client-sow/") && pathname !== "/app/client-sow") ||
    pathname.includes("/print")
  );
}

export function AppShell({
  children,
  isStaff,
  role,
  displayName,
}: {
  children: ReactNode;
  isStaff: boolean;
  role: string | null;
  displayName: string;
  initialPathname?: string;
}) {
  const pathname = usePathname();
  const staffPreviewingClient = Boolean(isStaff && isClientFacingAppPath(pathname));
  const useClientChrome = !isStaff || staffPreviewingClient;
  const hideChrome =
    useClientChrome &&
    (isClientGuidelineDetail(pathname) || isClientSowReadingSurface(pathname));

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {useClientChrome ? (
        <ClientSidebar />
      ) : (
        <Sidebar initialRole={role} initialDisplayName={displayName} />
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
