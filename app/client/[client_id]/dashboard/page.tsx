import { ClientDashboardView } from "@/modules/client/views/ClientDashboardView";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);
  return <ClientDashboardView access={access} />;
}
