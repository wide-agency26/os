import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { verifyPrintToken } from "@/lib/pdf/print-token";
import { loadGuidelinePrintByProject } from "@/lib/ci-builder/load-guideline-for-print";
import { CiPrintDocument } from "@/components/ci-builder/CiPrintDocument";

export const dynamic = "force-dynamic";

export default async function CiBuilderPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ project_id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { project_id } = await params;
  const { token } = await searchParams;
  const payload = verifyPrintToken(token ?? null);
  const tokenOk =
    (payload?.kind === "ci_draft" || payload?.kind === "ci") &&
    payload.projectId === project_id;

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
    if (!isFounder(profile?.role)) notFound();
  }

  const doc = await loadGuidelinePrintByProject(project_id);
  if (!doc) notFound();

  return (
    <CiPrintDocument
      brandName={doc.brandName}
      theme={doc.theme}
      sections={doc.sections}
      assets={doc.assets}
    />
  );
}
