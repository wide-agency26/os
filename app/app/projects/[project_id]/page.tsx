import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectDetailDashboard } from "./ProjectDetailDashboard";

export default async function ProjectDetailPage({ params }: { params: Promise<{ project_id: string }> }) {
  const { project_id } = await params;

  return (
    <Workspace>
      <ProjectDetailDashboard projectId={project_id} />
    </Workspace>
  );
}
