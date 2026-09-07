import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectTimesheetClient } from "@/components/pm/ProjectTimesheetClient";

export default async function ProjectPmTimesheetPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace wide>
      <ProjectTimesheetClient projectId={project_id} />
    </Workspace>
  );
}
