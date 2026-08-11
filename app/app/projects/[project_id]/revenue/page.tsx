import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectRevenueClient } from "@/components/pm/ProjectRevenueClient";

export default async function ProjectRevenuePage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace>
      <ProjectRevenueClient projectId={project_id} />
    </Workspace>
  );
}
