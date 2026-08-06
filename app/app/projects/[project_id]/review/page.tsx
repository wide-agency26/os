import { Workspace } from "@/components/frappe-ui/Workspace";
import { ProjectReviewQueueClient } from "@/components/pm/ProjectReviewQueueClient";

export default async function ProjectReviewPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <Workspace>
      <ProjectReviewQueueClient projectId={project_id} />
    </Workspace>
  );
}
