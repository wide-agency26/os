import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectContractPanel } from "@/components/pm/ProjectContractPanel";

export default async function ProjectContractPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace wide>
      <ProjectContractPanel projectId={project_id} />
    </Workspace>
  );
}
