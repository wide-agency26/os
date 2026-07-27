import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { ClientDashboard } from "@/components/reports/ClientDashboard";

export default async function ClientAnalyticsPage({
  params,
}: {
  params: Promise<{ client_id: string }>;
}) {
  const { client_id } = await params;
  await resolveClientReadAccess(client_id);

  return (
    <div className="mx-auto max-w-6xl py-8 px-4 page-enter">
      <ClientDashboard clientId={client_id} />
    </div>
  );
}
