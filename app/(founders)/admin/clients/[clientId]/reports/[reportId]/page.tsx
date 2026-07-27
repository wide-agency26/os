import { resolveExecutiveAccess } from "@/lib/wide-os/resolve-access";
import { FounderReportEditor } from "@/components/reports/FounderReportEditor";

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string; reportId: string }>;
}) {
  const { clientId, reportId } = await params;
  await resolveExecutiveAccess(); // Ensures founder access

  return (
    <div className="mx-auto max-w-5xl py-8 px-4 page-enter">
      <FounderReportEditor clientId={clientId} reportId={reportId} />
    </div>
  );
}
