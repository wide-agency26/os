import { notFound } from "next/navigation";
import { BrandGuidelinePreview } from "@/app/components/brand-guideline/BrandGuidelinePreview";
import { mergeWithDefaults, storedGuidelineHasContent } from "@/lib/brand-guideline/defaults";
import type { BrandGuidelineDocument } from "@/lib/brand-guideline/types";
import type { WideAccess } from "@/lib/wide-os/types";
import { ModuleScaffold } from "@/modules/_shared/ModuleScaffold";
import { createClient } from "@/utils/supabase/server";

/** Client read-only brand book — data written by CM at /cm/[id]/brandguideline. */
export async function ClientBrandGuidelineReadView({ access }: { access: WideAccess }) {
  const clientId = access.clientId;
  if (!clientId) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", clientId)
    .maybeSingle();

  const { data: brandHub } = await supabase
    .from("brand_hubs")
    .select("guideline_document, brand_colors, typography, logo_url")
    .eq("client_id", clientId)
    .maybeSingle();

  let guidelineDoc: BrandGuidelineDocument | null = null;
  if (brandHub?.guideline_document && storedGuidelineHasContent(brandHub.guideline_document)) {
    const label = profile?.full_name || profile?.company_name || "Your brand";
    guidelineDoc = mergeWithDefaults(brandHub.guideline_document, label);
  }

  return (
    <ModuleScaffold
      access={access}
      title="Brand guideline"
      description="Your living brand book — populated by your WIDE client manager."
    >
      {guidelineDoc ? (
        <BrandGuidelinePreview doc={guidelineDoc} className="min-h-[480px]" />
      ) : (
        <p className="text-sm text-text-secondary">
          Your brand book is being prepared. Check back after your discovery phase.
        </p>
      )}
    </ModuleScaffold>
  );
}
