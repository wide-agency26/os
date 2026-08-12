import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { loadPublishedSeoAuditBySlug } from "@/lib/seo-audit/load-published";
import { SeoAuditReportView } from "@/components/seo-audit/SeoAuditUI";

export const revalidate = 60;

export default async function PublicSeoAuditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublishedSeoAuditBySlug(slug);

  if (result.state !== "success" || !result.audit) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <FileQuestion className="w-10 h-10 mx-auto text-gray-300" />
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

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <SeoAuditReportView
          audit={result.audit}
          sharePath={`/a/${result.audit.public_slug}`}
        />
      </div>
    </div>
  );
}
