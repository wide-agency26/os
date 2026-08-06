import { PackagePlaybookEditor } from "@/components/pm/PackagePlaybookEditor";

export default async function PackagePlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PackagePlaybookEditor playbookId={id} />;
}
