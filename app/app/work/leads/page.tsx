import { Suspense } from "react";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import {
  WorkSectionFallback,
  WorkSectionHub,
} from "@/lib/work/section-page";
import { WorkLeadTools } from "@/components/work/WorkSectionShell";
import { requireStaffPage } from "@/lib/auth/staff-session";
import { workPaths } from "@/lib/work/paths";

export default async function WorkLeadsPage() {
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;

  return (
    <Suspense fallback={<WorkSectionFallback />}>
      <WorkSectionHub
        navContext="lead"
        basePath={workPaths.leads}
        title="Leads"
        subtitle="SOW, proposal, quote, and contract — click a row to open the project."
        defaultFilter="lead"
        tools={<WorkLeadTools />}
      />
    </Suspense>
  );
}
