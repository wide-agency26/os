import { Suspense } from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { WorkHub } from "@/components/work/WorkHub";
import { listBdRecords } from "@/app/actions/bd";
import { loadWorkHubRows } from "@/lib/work/load-hub";
import { requireStaffPage } from "@/lib/auth/staff-session";
import type { WorkNavContext } from "@/lib/work/navigation";

export async function loadWorkSectionData(view: "list" | "board" = "list") {
  const session = await requireStaffPage();
  const [rows, bd] = await Promise.all([
    loadWorkHubRows(session.supabase),
    view === "board"
      ? listBdRecords()
      : Promise.resolve({ ok: true as const, records: [], staff: [] }),
  ]);
  return {
    session,
    rows,
    records: bd.ok ? bd.records : [],
    staff: bd.ok ? bd.staff : [],
  };
}

export function WorkSectionFallback() {
  return (
    <Workspace wide>
      <p className="text-sm text-text-muted">Loading work…</p>
    </Workspace>
  );
}

export async function WorkSectionHub({
  navContext,
  basePath,
  title,
  subtitle,
  defaultFilter,
  showStageStrip = false,
  hideViewToggle = false,
  tools,
  view = "list",
}: {
  navContext: WorkNavContext;
  basePath: string;
  title: string;
  subtitle: string;
  defaultFilter: string;
  showStageStrip?: boolean;
  hideViewToggle?: boolean;
  tools?: React.ReactNode;
  view?: "list" | "board";
}) {
  const { session, rows, records, staff } = await loadWorkSectionData(view);
  return (
    <WorkHub
      rows={rows}
      records={records}
      staff={staff}
      currentUserId={session.user!.id}
      navContext={navContext}
      basePath={basePath}
      title={title}
      subtitle={subtitle}
      defaultFilter={defaultFilter as "active"}
      showStageStrip={showStageStrip}
      hideViewToggle={hideViewToggle}
      tools={tools}
    />
  );
}
