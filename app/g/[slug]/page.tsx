import { loadPublishedGuidelineBySlug } from "@/lib/ci-builder/load-published-guideline";
import { PublicGuidelineClient } from "./PublicGuidelineClient";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, FileQuestion, Lock } from "lucide-react";
import type { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";

export const revalidate = 60;

export default async function PublicGuidelinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublishedGuidelineBySlug(slug);

  if (result.state === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center mx-auto mb-4 border border-gray-200">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Brand Guide Not Found</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            No brand guideline exists for slug{" "}
            <span className="font-semibold text-gray-800">"/g/{slug}"</span>.
          </p>
          <Link
            href="/app/client-guidelines"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to portal
          </Link>
        </div>
      </div>
    );
  }

  if (result.state === "draft") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Draft Mode — Not Published</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            The brand guideline for{" "}
            <span className="font-semibold text-gray-800">{result.brandName}</span> has not been
            published yet.
          </p>
          <Link
            href="/app/client-guidelines"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to portal
          </Link>
        </div>
      </div>
    );
  }

  if (result.state === "no_snapshot") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Snapshot Missing</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            The published snapshot for{" "}
            <span className="font-semibold text-gray-800">{result.brandName}</span> could not be
            loaded.
          </p>
          <Link
            href="/app/client-guidelines"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PublicGuidelineClient
      mode="standalone"
      brandName={result.brandName}
      theme={result.theme as CITheme}
      sections={result.sections as Partial<CISection>[]}
      assets={result.assets as Partial<CIAsset>[]}
    />
  );
}
