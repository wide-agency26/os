import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { SOW_STATUS_LABELS } from "@/lib/sow/constants";
import { requireEnabledClientNav } from "@/app/actions/client-nav";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import { resolvePortalViewer } from "@/lib/client/portal-viewer";
import {
  ClientEmptyState,
  ClientPortalFrame,
} from "@/components/client/ClientPortalFrame";

export default async function ClientSowLibraryPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return (
      <ClientPortalFrame eyebrow="Scope" title="Scope of work">
        <p className="text-[13px] text-text-secondary">Sign in to view scopes of work.</p>
      </ClientPortalFrame>
    );
  }

  await requireEnabledClientNav("sow");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const viewer = await resolvePortalViewer(supabase as any, {
    userId: user.id,
    role: profile?.role ?? null,
  });

  let sowQuery = supabase
    .from("sows")
    .select(
      `
      id,
      title,
      status,
      published_at,
      updated_at,
      crm_customers!company_id (
        company,
        name
      )
    `
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const emptyForClient = !viewer.staff && viewer.companyIds.length === 0;
  if (viewer.companyIds.length) {
    sowQuery = sowQuery.in("company_id", viewer.companyIds);
  }
  const { data: sows } = emptyForClient ? { data: [] as never[] } : await sowQuery;
  const rows = sows ?? [];

  return (
    <ClientAccessFlowGate>
      <ClientPortalFrame
        eyebrow="Scope"
        title="Scope of work"
        subtitle="Published scopes for your company. Open a document to read or download PDF."
      >
        {rows.length === 0 ? (
          <ClientEmptyState
            title="No published scopes yet"
            message="When a scope of work is published for your company, it will appear here."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((sow) => {
              const co = sow.crm_customers as
                | { company?: string; name?: string }
                | { company?: string; name?: string }[]
                | null;
              const company = Array.isArray(co) ? co[0] : co;
              return (
                <Link
                  key={sow.id}
                  href={`/app/client-sow/${sow.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 hover:bg-surface-raised"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{sow.title}</p>
                    <p className="text-[12px] text-text-muted mt-0.5">
                      {company?.company || company?.name || "Company"} ·{" "}
                      {SOW_STATUS_LABELS[sow.status] || sow.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-text-secondary mt-0.5">
                    Open
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </ClientPortalFrame>
    </ClientAccessFlowGate>
  );
}
