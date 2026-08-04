"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { CompanyPickerModal } from "@/components/client/CompanyPickerModal";
import { PendingAccessCard } from "@/components/client/PendingAccessCard";
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

export default function ClientGuidelinesPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [membershipState, setMembershipState] = useState<"none" | "pending" | "active">("none");
  const [pendingCompanyName, setPendingCompanyName] = useState<string>("your organization");
  const [guidelines, setGuidelines] = useState<PublishedGuideline[]>([]);

  const supabase = createClient();

  const checkClientAccess = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // If user is founder/admin, redirect or show all published guidelines
      const isStaff = profile && isFounder(profile.role);

      // Check company_members
      const { data: members, error: memErr } = await (supabase as any)
        .from("company_members")
        .select("company_id, status")
        .eq("user_id", user.id);

      if (memErr) {
        console.error("Error checking company members:", memErr);
      }

      const activeCompanyIds: string[] = [];
      let hasPending = false;
      let pCompId = "";

      if (members && members.length > 0) {
        members.forEach((m: any) => {
          if (m.status === "active") {
            activeCompanyIds.push(m.company_id);
          } else if (m.status === "pending") {
            hasPending = true;
            pCompId = m.company_id;
          }
        });
      }

      if (isStaff) {
        setMembershipState("active");
      } else if (activeCompanyIds.length > 0) {
        setMembershipState("active");
      } else if (hasPending) {
        setMembershipState("pending");
        // Fetch company name for pending card
        if (pCompId) {
          const { data: cData } = await (supabase as any)
            .from("crm_customers")
            .select("company, name")
            .eq("id", pCompId)
            .maybeSingle();
          if (cData) setPendingCompanyName(cData.company || cData.name || "your organization");
        }
        setLoading(false);
        return;
      } else {
        setMembershipState("none");
        setLoading(false);
        return;
      }

      // Load guidelines
      let query = (supabase as any)
        .from("ci_guidelines")
        .select(`
          id,
          slug,
          brand_name,
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
        `)
        .eq("status", "published");

      if (!isStaff && activeCompanyIds.length > 0) {
        query = query.in("projects.client_id", activeCompanyIds);
      }

      const { data: glData, error: glErr } = await query;

      if (glErr) {
        console.error("Error loading guidelines:", glErr);
      } else if (glData) {
        const formatted: PublishedGuideline[] = glData.map((g: any) => {
          const proj = g.projects;
          const cust = proj?.crm_customers;
          return {
            id: g.id,
            slug: g.slug,
            brand_name: g.brand_name || proj?.title || "Brand Guideline",
            project_title: proj?.title || "Brand Guideline Project",
            company_name: cust?.company || cust?.name || "WIDE Client",
            updated_at: g.updated_at
          };
        });
        setGuidelines(formatted);
      }
    } catch (e) {
      console.error("Error in checkClientAccess:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkClientAccess();
  }, []);

  if (loading) {
    return (
      <Workspace>
        <div className="flex items-center justify-center h-[calc(100vh-120px)]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Workspace>
    );
  }

  if (membershipState === "none" && userId) {
    return (
      <CompanyPickerModal
        userId={userId}
        onRequestSubmitted={(compName) => {
          setPendingCompanyName(compName);
          setMembershipState("pending");
        }}
      />
    );
  }

  if (membershipState === "pending") {
    return <PendingAccessCard companyName={pendingCompanyName} />;
  }

  return (
    <Workspace>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="border-b border-gray-200 pb-5">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Your Brand Guidelines
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Access living brand identity specifications, design tokens, and AI brand prompts for your organization.
          </p>
        </div>

        {/* Guidelines Grid */}
        {guidelines.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No Published Brand Guidelines Yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Your organization currently has no published brand guidelines. As soon as your strategy team publishes a guideline, it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guidelines.map((g) => (
              <div
                key={g.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md hover:border-gray-300 transition-all group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      {g.company_name}
                    </span>
                    <span className="text-[10px] text-gray-400">
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
                    Open Guideline <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                  <Link
                    href={`/g/${g.slug}`}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    View Spec
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Workspace>
  );
}
