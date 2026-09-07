import { Suspense } from "react";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PageHeader } from "@/components/frappe-ui/primitives";
import { WorkArchivedTable } from "@/components/work/WorkClientsGrid";
import { loadWorkSectionData, WorkSectionFallback } from "@/lib/work/section-page";
import { requireStaffPage } from "@/lib/auth/staff-session";

async function ArchivedBody({ filter }: { filter?: string }) {
  const { rows } = await loadWorkSectionData();
  return (
    <Workspace wide>
      <div className="space-y-6">
        <PageHeader
          title={
            filter === "done"
              ? "Closed projects"
              : filter === "lose"
                ? "Lost deals"
                : "Archived"
          }
          subtitle="Closed projects and lost deals."
        />
        <WorkArchivedTable rows={rows} filter={filter} />
      </div>
    </Workspace>
  );
}

export default async function WorkArchivedPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const sp = await searchParams;

  return (
    <Suspense fallback={<WorkSectionFallback />}>
      <ArchivedBody filter={sp.filter} />
    </Suspense>
  );
}
