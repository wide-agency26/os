import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { RunProgress } from "@/components/seo/RunProgress";
import { ReportHeader, SeoReportView } from "@/components/seo/SeoReportView";
import { getRunProgress, loadSeoRun } from "@/lib/seo/load-run";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function SeoRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    return (
      <Workspace>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }

  const bundle = await loadSeoRun(id);
  if (!bundle) notFound();

  const progress = await getRunProgress(id);
  const isActive = bundle.run.status === "queued" || bundle.run.status === "running";

  return (
    <Workspace wide>
      <div className="space-y-5">
        <Link
          href="/app/seo"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={13} />
          All audits
        </Link>

        <ReportHeader
          bundle={bundle}
          shareUrl={`${getSiteUrl()}/a/${bundle.run.public_slug}`}
        />

        {(isActive || bundle.run.status === "failed") && progress ? (
          <RunProgress
            runId={id}
            initial={progress}
            maxPages={bundle.run.options.maxPages ?? 500}
          />
        ) : null}

        <SeoReportView bundle={bundle} />
      </div>
    </Workspace>
  );
}
