import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { SentimentReportView } from "@/components/sentiment/SentimentUI";
import { getSentimentReport } from "@/app/actions/sentiment";

export default async function SentimentDetailPage({
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
  const result = await getSentimentReport(id);
  if (!result.ok || !result.report) {
    if (result.error === "Not found") notFound();
    return (
      <Workspace>
        <p className="text-sm text-red-600">{result.error}</p>
      </Workspace>
    );
  }
  const report = result.report;
  return (
    <Workspace>
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <Link href="/app/sentiment" className="text-gray-500 hover:text-gray-900">
          ← All reports
        </Link>
        {report.bd_record_id && (
          <Link href={`/app/bd/${report.bd_record_id}`} className="text-violet-700">
            Open BD record
          </Link>
        )}
        {report.status === "ready" && (
          <a href={`/n/${report.public_slug}`} target="_blank" rel="noreferrer" className="text-blue-700">
            Public /n/{report.public_slug}
          </a>
        )}
      </div>
      {report.status === "failed" ? (
        <p className="text-sm text-red-600">{report.error_message}</p>
      ) : (
        <SentimentReportView report={report} sharePath={`/n/${report.public_slug}`} />
      )}
    </Workspace>
  );
}
