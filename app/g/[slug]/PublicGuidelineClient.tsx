"use client";

import React, { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";
import { GuidelineClientShell } from "@/components/ci-builder/templates/GuidelineClientShell";
import { ToastContainer } from "@/components/ci-builder/Toast";
import Link from "next/link";
import { Printer } from "lucide-react";

interface PublicGuidelineClientProps {
  brandName: string;
  theme: CITheme;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  /** portal = sits inside Client Portal shell; standalone = public /g/ page */
  mode?: "portal" | "standalone";
  slug?: string;
}

function PublicGuidelineInner(props: PublicGuidelineClientProps) {
  const { brandName, theme, sections, assets, mode = "standalone", slug } = props;
  const search = useSearchParams();
  const initialModuleId = search?.get("module") || null;

  const toolbar = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        {slug ? (
          <Link
            href={`/g/${slug}/print`}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-gray-700"
          >
            <Printer className="h-3.5 w-3.5" />
            PDF
          </Link>
        ) : null}
      </div>
    );
  }, [slug]);

  return (
    <>
      <GuidelineClientShell
        brandName={brandName}
        theme={theme}
        sections={sections}
        assets={assets}
        mode={mode}
        slug={slug}
        initialModuleId={initialModuleId}
        toolbar={toolbar}
      />
      <ToastContainer />
    </>
  );
}

export function PublicGuidelineClient(props: PublicGuidelineClientProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-gray-500">
          Loading guideline…
        </div>
      }
    >
      <PublicGuidelineInner {...props} />
    </Suspense>
  );
}
