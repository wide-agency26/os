import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadShareBySlug, listPublishedReportCategories } from "@/lib/reports/load-share";
import { loadUnlockedSharedReport, readUnlockedShare } from "@/app/actions/report-share";
import { ReportSharePasswordGate } from "@/components/reports/ReportSharePasswordGate";
import { PublicReportViewer } from "@/components/reports/PublicReportViewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared report",
  robots: { index: false, follow: false },
};

export default async function PublicSharedReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const share = await loadShareBySlug(slug);
  if (!share || !share.enabled) notFound();

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("title, client:client_id ( company, name )")
    .eq("id", share.projectId)
    .maybeSingle();
  const client = Array.isArray(project?.client) ? project?.client[0] : project?.client;
  const organization = client?.company || client?.name || project?.title || "Report";

  const unlocked = await readUnlockedShare(slug);
  if (!unlocked) {
    return <ReportSharePasswordGate slug={slug} organization={organization} />;
  }

  const published = await listPublishedReportCategories(share.projectId);
  if (!published.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-[14px] text-text-secondary">
          Nothing is published on this report yet.
        </p>
      </div>
    );
  }

  const loaded = await loadUnlockedSharedReport(slug, published[0]);
  if (!loaded.ok) {
    return <ReportSharePasswordGate slug={slug} organization={organization} />;
  }

  return (
    <PublicReportViewer
      slug={slug}
      initial={{
        projectId: loaded.projectId,
        published: loaded.published,
        data: loaded.data,
      }}
    />
  );
}
