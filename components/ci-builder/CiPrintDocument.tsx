import { GuidelineClientShell } from "@/components/ci-builder/templates/GuidelineClientShell";
import { PdfReadyMark } from "@/components/pdf/PdfReadyMark";
import type { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";

export function CiPrintDocument({
  brandName,
  theme,
  sections,
  assets,
}: {
  brandName: string;
  theme: CITheme;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
}) {
  return (
    <div className="pdf-print-root bg-white min-h-screen">
      <PdfReadyMark delayMs={800} />
      <GuidelineClientShell
        brandName={brandName}
        theme={theme}
        sections={sections}
        assets={assets}
      />
    </div>
  );
}
