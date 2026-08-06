import { loadPublishedGuidelineBySlug } from "@/lib/ci-builder/load-published-guideline";
import { PublicGuidelineClient } from "@/app/g/[slug]/PublicGuidelineClient";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, FileQuestion, Lock } from "lucide-react";
import type { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";

export const revalidate = 60;

function StatusCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center mx-auto mb-4 border border-gray-200">
          {icon}
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">{body}</p>
        <Link
          href="/app/client-guidelines"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to guidelines
        </Link>
      </div>
    </div>
  );
}

export default async function PortalGuidelinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublishedGuidelineBySlug(slug);

  if (result.state === "not_found") {
    return (
      <StatusCard
        icon={<FileQuestion className="w-6 h-6" />}
        title="Brand Guide Not Found"
        body={
          <>
            No brand guideline exists for{" "}
            <span className="font-semibold text-gray-800">“{slug}”</span>.
          </>
        }
      />
    );
  }

  if (result.state === "draft") {
    return (
      <StatusCard
        icon={<Lock className="w-6 h-6 text-amber-600" />}
        title="Not published yet"
        body={
          <>
            <span className="font-semibold text-gray-800">{result.brandName}</span> is still in
            draft. Ask your WIDE team to publish it.
          </>
        }
      />
    );
  }

  if (result.state === "no_snapshot") {
    return (
      <StatusCard
        icon={<ShieldAlert className="w-6 h-6 text-red-600" />}
        title="Snapshot missing"
        body={
          <>
            The published snapshot for{" "}
            <span className="font-semibold text-gray-800">{result.brandName}</span> could not be
            loaded. Please ask your team to republish.
          </>
        }
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col -m-0 overflow-hidden bg-white">
      <PublicGuidelineClient
        mode="portal"
        brandName={result.brandName}
        theme={result.theme as CITheme}
        sections={result.sections as Partial<CISection>[]}
        assets={result.assets as Partial<CIAsset>[]}
      />
    </div>
  );
}
