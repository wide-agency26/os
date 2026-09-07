import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectTasksClient } from "@/components/pm/ProjectTasksClient";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace wide>
      <ProjectTasksClient projectId={project_id} />
    </Workspace>
  );
}
