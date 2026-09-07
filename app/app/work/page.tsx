import { Suspense } from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { WorkHub } from "@/components/work/WorkHub";
import { listBdRecords } from "@/app/actions/bd";
import { loadWorkHubRows } from "@/lib/work/load-hub";
import { requireStaffPage } from "@/lib/auth/staff-session";

async function WorkHubBody({
  view,
  userId,
}: {
  view: "list" | "board";
  userId: string;
}) {
  const session = await requireStaffPage();
  const [rows, bd] = await Promise.all([
    loadWorkHubRows(session.supabase),
    view === "board"
      ? listBdRecords()
      : Promise.resolve({ ok: true as const, records: [], staff: [] }),
  ]);

  return (
    <WorkHub
      rows={rows}
      records={bd.ok ? bd.records : []}
      staff={bd.ok ? bd.staff : []}
      currentUserId={userId}
      navContext="full"
      showStageStrip
    />
  );
}

export default async function WorkHubPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;

  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "list";

  return (
    <Suspense
      fallback={
        <Workspace>
          <p className="text-sm text-text-muted">Loading work…</p>
        </Workspace>
      }
    >
      <WorkHubBody view={view} userId={session.user!.id} />
    </Suspense>
  );
}
