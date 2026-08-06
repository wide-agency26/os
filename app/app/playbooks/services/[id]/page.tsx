import { ServicePlaybookEditor } from "@/components/pm/ServicePlaybookEditor";

export default async function ServicePlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ServicePlaybookEditor playbookId={id} />;
}
