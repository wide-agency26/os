import { ReactNode, Suspense } from "react";
import { getStaffSession } from "@/lib/auth/staff-session";
import { AppShell } from "@/components/frappe-ui/AppShell";
import { ActivityTracker } from "@/components/activity/ActivityTracker";
import { DebugReporterHost } from "@/components/debug/DebugReporterHost";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();

  return (
    <>
      <ActivityTracker />
      {session.isStaff ? (
        <Suspense fallback={null}>
          <DebugReporterHost enabled />
        </Suspense>
      ) : null}
      <AppShell
        isStaff={session.isStaff}
        role={session.profile?.role ?? null}
        displayName={session.profile?.full_name || "Admin User"}
      >
        {children}
      </AppShell>
    </>
  );
}
