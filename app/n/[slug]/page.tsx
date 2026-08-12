import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { loadPublishedSentimentBySlug } from "@/lib/sentiment/load-published";
import { SentimentReportView } from "@/components/sentiment/SentimentUI";

export const revalidate = 60;

export default async function PublicSentimentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublishedSentimentBySlug(slug);
  if (result.state !== "success" || !result.report) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <FileQuestion className="w-10 h-10 mx-auto text-gray-300" />
          <h1 className="text-xl font-semibold">Report not found</h1>
          <Link href="https://www.wide-communication.com" className="text-sm underline">
            wide-communication.com
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <SentimentReportView
          report={result.report}
          sharePath={`/n/${result.report.public_slug}`}
        />
      </div>
    </div>
  );
}
