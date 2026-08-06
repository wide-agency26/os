import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectOverviewClient } from "@/components/pm/ProjectOverviewClient";

export default async function ProjectPmOverviewPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace>
      <ProjectOverviewClient projectId={project_id} />
    </Workspace>
  );
}
