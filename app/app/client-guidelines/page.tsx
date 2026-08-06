"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import { isFounder } from "@/lib/rbac";
import { BookOpen, Building2, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";

interface PublishedGuideline {
  id: string;
  slug: string;
  brand_name: string;
  project_title: string;
  company_name: string;
  updated_at: string;
}

function GuidelinesContent() {
  const [loading, setLoading] = useState(true);
  const [guidelines, setGuidelines] = useState<PublishedGuideline[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGuidelines() {
      setLoading(true);
      setLoadError(null);
      const supabase = createClient();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const isStaff = profile && isFounder(profile.role);

        const { data: members, error: memErr } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (memErr) {
          console.error("Error loading company memberships:", memErr);
          setLoadError(memErr.message);
          return;
        }

        const activeCompIds = (members ?? []).map((m) => m.company_id);

        // Clients with no company membership see an empty library (not all brands)
        if (!isStaff && activeCompIds.length === 0) {
          setGuidelines([]);
          return;
        }

        let query = supabase
          .from("ci_guidelines")
          .select(
            `
            id,
            slug,
            updated_at,
            projects!inner (
              id,
              title,
              client_id,
              crm_customers!client_id (
                id,
                company,
                name
              )
            )
          `
          )
          .eq("status", "published")
          .not("slug", "is", null);

        if (!isStaff) {
          query = query.in("projects.client_id", activeCompIds);
        }

        const { data: glData, error: glErr } = await query;

        if (glErr) {
          console.error("Error loading guidelines:", glErr);
          setLoadError(glErr.message);
          return;
        }

        const formatted: PublishedGuideline[] = (glData ?? []).flatMap((g) => {
          const proj = Array.isArray(g.projects) ? g.projects[0] : g.projects;
          if (!proj) return [];
          const custRaw = (proj as { crm_customers?: unknown }).crm_customers;
          const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw;
          const company =
            (cust as { company?: string; name?: string } | null)?.company ||
            (cust as { company?: string; name?: string } | null)?.name ||
            "WIDE Client";
          const title = (proj as { title?: string }).title || "Brand Guideline Project";
          return [
            {
              id: g.id,
              slug: g.slug as string,
              brand_name: title,
              project_title: title,
              company_name: company,
              updated_at: g.updated_at as string,
            },
          ];
        });

        setGuidelines(formatted);
      } catch (e) {
        console.error("Error in loadGuidelines:", e);
        setLoadError(e instanceof Error ? e.message : "Failed to load guidelines");
      } finally {
        setLoading(false);
      }
    }
    void loadGuidelines();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <Workspace>
      <div className="space-y-8 pb-12">
        <div className="border-b border-gray-200 pb-5">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Your Brand Guidelines
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Access living brand identity specifications, design tokens, and AI brand prompts for
            your organization.
          </p>
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            Couldn’t load guidelines: {loadError}
          </div>
        )}

        {guidelines.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No Published Brand Guidelines Yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Your organization currently has no published brand guidelines. As soon as your
              strategy team publishes a guideline linked to your company, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guidelines.map((g) => (
              <Link
                key={g.id}
                href={`/app/client-guidelines/${g.slug}`}
                className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      {g.company_name}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      Updated {new Date(g.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {g.brand_name}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">{g.project_title}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 mt-6 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-600 group-hover:underline inline-flex items-center gap-1">
                    Open guideline <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                  <span className="px-3.5 py-2 bg-blue-600 group-hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm">
                    View
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Workspace>
  );
}

export default function ClientGuidelinesPage() {
  return (
    <ClientAccessFlowGate>
      <GuidelinesContent />
    </ClientAccessFlowGate>
  );
}
