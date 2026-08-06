import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectDetailDashboard } from "../ProjectDetailDashboard";

/** Legacy ERP project dashboard (Gantt / erp_tasks). Prefer PM Overview at /app/projects/[id]. */
export default async function ProjectLegacyErpPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace>
      <ProjectDetailDashboard projectId={project_id} />
    </Workspace>
  );
}
