import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { loadPublishedSeoAuditBySlug } from "@/lib/seo-audit/load-published";
import { SeoAuditReportView } from "@/components/seo-audit/SeoAuditUI";
import { loadSeoRun } from "@/lib/seo/load-run";
import { ReportDocument } from "@/components/seo/ReportDocument";

export const revalidate = 60;

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6">
      <div className="max-w-md space-y-3 text-center">
        <FileQuestion className="mx-auto h-10 w-10 text-gray-300" />
        <h1 className="text-xl font-semibold text-gray-900">Audit not found</h1>
        <p className="text-sm text-gray-500">
          This share link is invalid or the audit is not ready.
        </p>
        <Link
          href="https://www.wide-communication.com"
          className="text-sm text-gray-900 underline"
        >
          wide-communication.com
        </Link>
      </div>
    </div>
  );
}

export default async function PublicSeoAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { slug } = await params;
  const { print } = await searchParams;

  // Deep auditor runs resolve first; legacy one-page scans keep working so
  // links already shared with prospects do not break.
  const bundle = await loadSeoRun(slug, { bySlug: true, includePages: false });
  if (bundle && bundle.run.status === "ready") {
    return (
      <div className="min-h-screen bg-white">
        <ReportDocument bundle={bundle} autoPrint={print === "1"} />
      </div>
    );
  }

  const result = await loadPublishedSeoAuditBySlug(slug);
  if (result.state !== "success" || !result.audit) return <NotFound />;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <SeoAuditReportView
          audit={result.audit}
          sharePath={`/a/${result.audit.public_slug}`}
        />
      </div>
    </div>
  );
}
