import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { verifyPrintToken } from "@/lib/pdf/print-token";
import { userCanAccessPublishedSlug } from "@/lib/pdf/access";
import { loadGuidelinePrintBySlug } from "@/lib/ci-builder/load-guideline-for-print";
import { CiPrintDocument } from "@/components/ci-builder/CiPrintDocument";

export const dynamic = "force-dynamic";

export default async function PublicGuidelinePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;
  const payload = verifyPrintToken(token ?? null);

  const tokenOk =
    payload?.kind === "ci" && (!payload.slug || payload.slug === slug);

  if (!tokenOk) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    const access = await userCanAccessPublishedSlug(
      user?.id ?? null,
      profile?.role ?? null,
      slug
    );
    if (!access.ok && !access.published) notFound();
  }

  const doc = await loadGuidelinePrintBySlug(slug);
  if (!doc) notFound();

  return (
    <CiPrintDocument
      brandName={doc.brandName}
      theme={doc.theme}
      sections={doc.sections}
      assets={doc.assets}
    />
  );
}
