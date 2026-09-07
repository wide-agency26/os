"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { ClientNavGuard } from "@/components/client/ClientNavGuard";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import {
  ClientEmptyState,
  ClientPortalFrame,
} from "@/components/client/ClientPortalFrame";
import { isFounder } from "@/lib/rbac";
import { getViewAsCompany } from "@/app/actions/view-as-client";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface PublishedGuideline {
  id: string;
  slug: string;
  brand_name: string;
  project_title: string;
  company_name: string;
  updated_at: string;
  project_id?: string;
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
        const viewAs = isStaff ? await getViewAsCompany() : null;

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
          .not("slug", "is", null)
          .eq("projects.client_visible", true);

        if (!isStaff) {
          query = query.in("projects.client_id", activeCompIds);
        } else if (viewAs?.id) {
          query = query.eq("projects.client_id", viewAs.id);
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
              project_id: (proj as { id?: string }).id || "",
            },
          ];
        });

        let visible = formatted;
        if (!isStaff) {
          const { data: memRows } = await supabase
            .from("company_members")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "active");
          const memberIds = (memRows ?? []).map((m) => m.id);
          if (memberIds.length) {
            const { data: grants } = await (supabase as any)
              .from("project_members")
              .select("project_id")
              .in("company_member_id", memberIds)
              .eq("status", "active");
            const granted = new Set(
              ((grants ?? []) as { project_id: string }[]).map((g) => g.project_id)
            );
            if (granted.size > 0) {
              visible = formatted.filter((g) => g.project_id && granted.has(g.project_id));
            }
          }
        }

        setGuidelines(visible);
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
      <div className="flex items-center justify-center min-h-[calc(100dvh-var(--os-header))]">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <ClientPortalFrame
      eyebrow="Brand"
      title="Brand guidelines"
      subtitle="Published identity specs for your organization."
    >
      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          Couldn’t load guidelines: {loadError}
        </div>
      ) : null}

      {guidelines.length === 0 ? (
        <ClientEmptyState
          title="No published guidelines yet"
          message="When your strategy team publishes a guideline linked to your company, it will appear here."
        />
      ) : (
        <div className="space-y-2">
          {guidelines.map((g) => (
            <Link
              key={g.id}
              href={`/app/client-guidelines/${g.slug}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 hover:bg-surface-raised"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-text-primary truncate">
                  {g.brand_name}
                </p>
                <p className="text-[12px] text-text-muted mt-0.5">
                  {g.company_name} · Updated {new Date(g.updated_at).toLocaleDateString()}
                </p>
              </div>
              <span className="shrink-0 text-[12px] font-medium text-text-secondary mt-0.5">
                Open
              </span>
            </Link>
          ))}
        </div>
      )}
    </ClientPortalFrame>
  );
}

export default function ClientGuidelinesPage() {
  return (
    <ClientAccessFlowGate>
      <ClientNavGuard navKey="guidelines" />
      <GuidelinesContent />
    </ClientAccessFlowGate>
  );
}
