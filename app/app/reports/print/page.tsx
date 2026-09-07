import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { verifyPrintToken } from "@/lib/pdf/print-token";
import { userCanAccessProject } from "@/lib/pdf/access";
import { loadReportPrintData } from "@/lib/reports/load-print-data";
import { isReportCategory, type ReportCategory } from "@/lib/reports/categories";
import { ReportPrintDocument } from "@/components/reports/ReportPrintDocument";

export const dynamic = "force-dynamic";

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; category?: string; token?: string }>;
}) {
  const sp = await searchParams;
  const projectId = sp.project || "";
  const category = isReportCategory(sp.category || "")
    ? (sp.category as ReportCategory)
    : "General";
  if (!projectId) notFound();

  const payload = verifyPrintToken(sp.token ?? null);
  const tokenOk =
    payload?.kind === "report" &&
    payload.projectId === projectId &&
    (!payload.category || payload.category === category);

  if (!tokenOk) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const allowed =
      isFounder(profile?.role) ||
      (await userCanAccessProject(user.id, profile?.role ?? null, projectId));
    if (!allowed) notFound();
  }

  const data = await loadReportPrintData(projectId, category);
  if (!data) notFound();

  return (
    <ReportPrintDocument
      organization={data.organization}
      projectTitle={data.projectTitle}
      category={data.category}
      projectId={data.projectId}
      datasets={data.datasets}
      channelPresence={data.channelPresence}
    />
  );
}
