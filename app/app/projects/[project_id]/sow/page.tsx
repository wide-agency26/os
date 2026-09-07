import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectSowPanel } from "@/components/pm/ProjectSowPanel";

export default async function ProjectSowPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace wide>
      <ProjectSowPanel projectId={project_id} />
    </Workspace>
  );
}
