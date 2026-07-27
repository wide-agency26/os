import { redirect } from "next/navigation";

export default async function AdminClientWorkspaceRedirectPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  redirect(`/admin/cm/${clientId}/dashboard`);
}
