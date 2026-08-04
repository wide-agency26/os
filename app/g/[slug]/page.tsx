import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { PublicGuidelineClient } from "./PublicGuidelineClient";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, FileQuestion, Lock } from "lucide-react";

export const revalidate = 0; // Disable stale caching during active testing

type FetchResult =
  | { state: "not_found" }
  | { state: "draft"; brandName: string }
  | { state: "no_snapshot"; brandName: string }
  | { state: "success"; brandName: string; theme: any; sections: any[]; assets: any[] };

async function fetchVersionSnapshot(supabase: any, guideline: any, brandName: string): Promise<FetchResult> {
  // Fetch latest published version snapshot
  const { data: version, error: verErr } = await supabase
    .from("ci_guideline_versions")
    .select("content")
    .eq("guideline_id", guideline.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verErr || !version || !version.content) {
    // Fallback: try fetching draft sections & assets directly if snapshot is missing
    const { data: draftSecs } = await supabase
      .from("ci_sections")
      .select("*")
      .eq("guideline_id", guideline.id)
      .order("position", { ascending: true });

    const { data: draftAssets } = await supabase
      .from("ci_assets")
      .select("*")
      .eq("guideline_id", guideline.id);

    if (draftSecs && draftSecs.length > 0) {
      return {
        state: "success",
        brandName,
        theme: guideline.theme || {},
        sections: draftSecs,
        assets: draftAssets || []
      };
    }

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

async function fetchGuidelineData(slug: string): Promise<FetchResult> {
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
    .select("id, status, theme, project_id, projects(name)")
    .eq("slug", slug)
    .maybeSingle();

  if (glErr) {
    console.error("[CI Viewer] Error fetching guideline by slug:", glErr);
    // If joining projects failed (e.g. RLS on projects), retry without joining projects
    const { data: fallbackGl } = await supabase
      .from("ci_guidelines")
      .select("id, status, theme, project_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!fallbackGl) return { state: "not_found" };
    if (fallbackGl.status !== "published") return { state: "draft", brandName: "Brand System" };
    return await fetchVersionSnapshot(supabase, fallbackGl, "Brand System");
  }

  if (!guideline) {
    return { state: "not_found" };
  }

  if (guideline.status !== "published") {
    return { state: "draft", brandName: guideline.projects?.name || "Brand System" };
  }

  const brandName = guideline.projects?.name || "Brand System";
  return await fetchVersionSnapshot(supabase, guideline, brandName);
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
            No brand guideline exists for slug <span className="font-semibold text-gray-800">"/g/{slug}"</span>. Please check the link or contact the administrator.
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

  if (result.state === "draft") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Draft Mode — Not Published Yet</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            The brand guideline for <span className="font-semibold text-gray-800">{result.brandName}</span> is currently in draft mode. Click <strong>Publish</strong> inside the CI Builder to make it live for clients.
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

  if (result.state === "no_snapshot") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Snapshot Missing</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            The published snapshot for <span className="font-semibold text-gray-800">{result.brandName}</span> could not be loaded. Please click Publish again in the builder to generate a fresh snapshot.
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
