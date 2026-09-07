"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Awesomebar } from "@/components/frappe-ui/Awesomebar";
import {
  MobileBottomNav,
  MobileNavBackdrop,
  MobileNavProvider,
} from "@/components/frappe-ui/MobileNav";
import {
  SuperadminClientPreviewBanner,
  isClientFacingAppPath,
} from "@/components/client/SuperadminClientPreviewBanner";

const sidebarFallback = (
  <aside className="hidden md:block w-[240px] shrink-0 border-r border-border bg-sidebar" />
);

const Sidebar = dynamic(
  () => import("@/components/frappe-ui/Sidebar").then((m) => m.Sidebar),
  { ssr: false, loading: () => sidebarFallback }
);

const ClientSidebar = dynamic(
  () =>
    import("@/components/client/ClientSidebar").then((m) => m.ClientSidebar),
  { ssr: false, loading: () => sidebarFallback }
);

function isClientGuidelinePreview(pathname: string) {
  return pathname.startsWith("/app/client-guidelines/preview/");
}

function isClientGuidelineDetail(pathname: string) {
  return (
    pathname.startsWith("/app/client-guidelines/") &&
    pathname !== "/app/client-guidelines" &&
    !isClientGuidelinePreview(pathname)
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
  const ciPreview = isClientGuidelinePreview(pathname);
  const hideChrome =
    pathname.includes("/print") ||
    (useClientChrome &&
      (isClientGuidelineDetail(pathname) || isClientSowReadingSurface(pathname)));

  if (hideChrome) {
    return <div className="pdf-print-root bg-white min-h-screen">{children}</div>;
  }

  return (
    <MobileNavProvider>
      <div className="os-shell flex h-[100dvh] w-full max-w-[100vw] bg-background overflow-hidden text-text-primary antialiased selection:bg-sidebar-active selection:text-text-primary">
        {useClientChrome ? (
          <ClientSidebar />
        ) : (
          <Sidebar initialRole={role} initialDisplayName={displayName} />
        )}
        <MobileNavBackdrop />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {staffPreviewingClient && <SuperadminClientPreviewBanner />}
          {!hideChrome && !ciPreview && (
            <Awesomebar
              title={useClientChrome ? "WIDE Client Portal" : "WIDE OS Workspace"}
              showNotifications={isStaff && !staffPreviewingClient}
            />
          )}
          <div
            className={`flex-1 min-h-0 min-w-0 ${
              hideChrome || ciPreview
                ? "overflow-hidden flex flex-col"
                : "overflow-auto os-main-scroll"
            }`}
          >
            {children}
          </div>
        </div>
        {!hideChrome && (
          <MobileBottomNav variant={useClientChrome ? "client" : "staff"} />
        )}
      </div>
    </MobileNavProvider>
  );
}
