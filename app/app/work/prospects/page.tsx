import { Suspense } from "react";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import {
  WorkSectionFallback,
  WorkSectionHub,
} from "@/lib/work/section-page";
import { WorkProspectTools } from "@/components/work/WorkSectionShell";
import { requireStaffPage } from "@/lib/auth/staff-session";
import { workPaths } from "@/lib/work/paths";

export default async function WorkProspectsPage() {
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;

  return (
    <Suspense fallback={<WorkSectionFallback />}>
      <WorkSectionHub
        navContext="prospect"
        basePath={workPaths.prospects}
        title="Prospects"
        subtitle="Find and qualify — click a row to open the pipeline card."
        defaultFilter="prospecting"
        tools={<WorkProspectTools />}
      />
    </Suspense>
  );
}
