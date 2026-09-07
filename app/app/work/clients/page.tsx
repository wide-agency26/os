import { Suspense } from "react";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PageHeader } from "@/components/frappe-ui/primitives";
import { WorkClientsGrid } from "@/components/work/WorkClientsGrid";
import { WorkClientTools } from "@/components/work/WorkSectionShell";
import { loadWorkSectionData, WorkSectionFallback } from "@/lib/work/section-page";
import { requireStaffPage } from "@/lib/auth/staff-session";

async function ClientsBody() {
  const { rows } = await loadWorkSectionData();
  return (
    <Workspace wide>
      <div className="space-y-6">
        <PageHeader
          title="Clients"
          subtitle="Live delivery work — open any project card below."
        />
        <WorkClientTools />
        <WorkClientsGrid rows={rows} />
      </div>
    </Workspace>
  );
}

export default async function WorkClientsPage() {
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;

  return (
    <Suspense fallback={<WorkSectionFallback />}>
      <ClientsBody />
    </Suspense>
  );
}
