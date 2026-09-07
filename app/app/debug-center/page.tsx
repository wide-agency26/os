import { requireStaffPage } from "@/lib/auth/staff-session";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { listDebugReports } from "@/app/actions/debug-reports";
import { DebugCenterClient } from "@/components/debug/DebugCenterClient";

export const dynamic = "force-dynamic";

export default async function DebugCenterPage() {
  const session = await requireStaffPage();
  if (!session.isStaff) {
    return (
      <Workspace>
        <p className="text-[13px] text-text-secondary">Founders only.</p>
      </Workspace>
    );
  }

  const res = await listDebugReports({ includeResolved: true, includeHidden: true });
  if (!res.ok) {
    return (
      <Workspace>
        <h1 className="text-2xl font-semibold text-text-primary">Debug center</h1>
        <p className="text-[13px] text-text-secondary mt-2">{res.error}</p>
      </Workspace>
    );
  }

  return (
    <Workspace wide>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Settings
      </p>
      <h1 className="text-2xl font-semibold text-text-primary mt-1">Debug center</h1>
      <p className="text-[13px] text-text-secondary mt-1 mb-6 max-w-2xl">
        Bugs you and Thomas file from any page, including client-preview tabs that
        have no URL. Copy markdown into Cursor when you want a fix pass. Hide or
        mark resolved after it ships.
      </p>
      <DebugCenterClient initial={res.reports} />
    </Workspace>
  );
}
