import { resolveExecutiveAccess } from "@/lib/wide-os/resolve-access";
import { DashboardBuilder } from "@/components/reports/DashboardBuilder";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await resolveExecutiveAccess(); // Ensures founder access

  return (
    <div className="mx-auto max-w-5xl py-8 px-4 page-enter">
      <ContextExplainer
        title="DASHBOARD BUILDER"
        description="Build an automated performance dashboard for this client by adding widgets and mapping data sources."
        storageKey="admin-dashboard-builder"
      />
      <DashboardBuilder clientId={clientId} />
    </div>
  );
}
