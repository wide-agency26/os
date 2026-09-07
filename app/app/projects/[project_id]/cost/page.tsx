import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectCostClient } from "@/components/pm/ProjectCostClient";

export default async function ProjectCostPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace wide>
      <ProjectCostClient projectId={project_id} />
    </Workspace>
  );
}
