import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { PublicGuidelineClient } from "./PublicGuidelineClient";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, FileQuestion, Lock } from "lucide-react";

export const revalidate = 60; // 60s cache revalidation for published guidelines

type FetchResult =
  | { state: "not_found" }
  | { state: "draft"; brandName: string }
  | { state: "no_snapshot"; brandName: string }
  | { state: "success"; brandName: string; theme: any; sections: any[]; assets: any[] };

async function fetchGuidelineData(slug: string): Promise<FetchResult> {
  // Use admin client server-side to bypass RLS, fallback to anon client if key not available
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // 1. Fetch guideline by slug
  const { data: guideline, error: glErr } = await supabase
    .from("ci_guidelines")
    .select("id, status, theme, project_id, projects(title)")
    .eq("slug", slug)
    .maybeSingle();

  if (glErr || !guideline) {
    console.error("[CI Public Viewer] Guideline query error or not found:", glErr);
    return { state: "not_found" };
  }

  const brandName = guideline.projects?.title || "Brand System";

  if (guideline.status !== "published") {
    return { state: "draft", brandName };
  }

  // 2. Fetch published version snapshot
  const { data: version, error: verErr } = await supabase
    .from("ci_guideline_versions")
    .select("content")
    .eq("guideline_id", guideline.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verErr || !version || !version.content) {
    console.error("[CI Public Viewer] Version snapshot query error or missing:", verErr);
    return { state: "no_snapshot", brandName };
  }

  const content = version.content;

  return {
    state: "success",
    brandName,
    theme: content.theme || guideline.theme || {},
    sections: content.sections || [],
    assets: content.assets || []
  };
}

export default async function PublicGuidelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await fetchGuidelineData(slug);

  if (result.state === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center mx-auto mb-4 border border-gray-200">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Brand Guide Not Found</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            No brand guideline exists for slug <span className="font-semibold text-gray-800">"/g/{slug}"</span>. Please verify the URL slug.
          </p>
          <div className="pt-4 border-t border-gray-100 flex justify-center">
            <Link
              href="/app/home"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return Home</span>
            </Link>
          </div>
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
            The brand guideline for <span className="font-semibold text-gray-800">{result.brandName}</span> has not been published yet. Please publish it inside the CI Builder to make it available.
          </p>
          <div className="pt-4 border-t border-gray-100 flex justify-center">
            <Link
              href="/app/home"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return Home</span>
            </Link>
          </div>
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
            The published snapshot for <span className="font-semibold text-gray-800">{result.brandName}</span> could not be loaded. Please republish inside the builder.
          </p>
          <div className="pt-4 border-t border-gray-100 flex justify-center">
            <Link
              href="/app/home"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (result.state === "success") {
    return (
      <PublicGuidelineClient
        brandName={result.brandName}
        theme={result.theme}
        sections={result.sections}
        assets={result.assets}
      />
    );
  }

  return null;
}
