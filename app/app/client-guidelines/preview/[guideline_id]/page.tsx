import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { readViewAsCompanyId } from "@/lib/client/view-as.server";
import { loadLiveGuidelineById } from "@/lib/ci-builder/load-guideline-for-print";
import { PublicGuidelineClient } from "@/app/g/[slug]/PublicGuidelineClient";
import type { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";
import { FileQuestion } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientGuidelinePreviewPage({
  params,
}: {
  params: Promise<{ guideline_id: string }>;
}) {
  const { guideline_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    redirect("/app/client-guidelines");
  }

  const viewAsCompany = await readViewAsCompanyId();
  if (!viewAsCompany) {
    redirect("/app/work/view-as");
  }

  const doc = await loadLiveGuidelineById(guideline_id);
  if (!doc) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center mx-auto mb-4">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Guideline not found</h1>
          <p className="text-sm text-gray-600 mb-6">
            This brand guideline could not be loaded for client preview.
          </p>
          <Link
            href="/app/client-guidelines"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-xl"
          >
            Back to guidelines
          </Link>
        </div>
      </div>
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", doc.projectId)
    .maybeSingle();
  if (project?.client_id && project.client_id !== viewAsCompany) {
    redirect("/app/client-guidelines");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
      <PublicGuidelineClient
        mode="portal"
        slug={doc.slug || undefined}
        brandName={doc.brandName}
        theme={doc.theme as CITheme}
        sections={doc.sections as Partial<CISection>[]}
        assets={doc.assets as Partial<CIAsset>[]}
      />
    </div>
  );
}
