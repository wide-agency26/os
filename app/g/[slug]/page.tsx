import { createClient } from "@supabase/supabase-js";
import { PublicGuidelineClient } from "./PublicGuidelineClient";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";

export const revalidate = 60; // Cache for 60 seconds

async function getPublishedGuideline(slug: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fetch published guideline
  const { data: guideline, error: glErr } = await (supabase as any)
    .from("ci_guidelines")
    .select("id, theme, project_id, projects(name)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (glErr || !guideline) {
    return null;
  }

  // 2. Fetch latest published snapshot version
  const { data: version, error: verErr } = await (supabase as any)
    .from("ci_guideline_versions")
    .select("content")
    .eq("guideline_id", guideline.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verErr || !version || !version.content) {
    return null;
  }

  const brandName = guideline.projects?.name || "Brand System";
  const content = version.content;

  return {
    brandName,
    theme: content.theme || guideline.theme || {},
    sections: content.sections || [],
    assets: content.assets || []
  };
}

export default async function PublicGuidelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublishedGuideline(slug);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Brand Guide Unavailable</h1>
          
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            The brand guideline for <span className="font-semibold text-gray-800">"/g/{slug}"</span> could not be found or has not been published yet.
          </p>

          <div className="pt-4 border-t border-gray-100 flex justify-center">
            <Link
              href="/app/home"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Portal</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PublicGuidelineClient
      brandName={data.brandName}
      theme={data.theme}
      sections={data.sections}
      assets={data.assets}
    />
  );
}
