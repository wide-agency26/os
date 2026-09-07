import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { ReportDocument } from "@/components/seo/ReportDocument";
import { loadSeoRun } from "@/lib/seo/load-run";
import { requireEnabledClientNav } from "@/app/actions/client-nav";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import {
  ClientEmptyState,
  ClientPortalFrame,
} from "@/components/client/ClientPortalFrame";
import { resolvePortalViewer } from "@/lib/client/portal-viewer";

/**
 * Client-facing SEO audit.
 *
 * Read-only and scoped: a client sees the most recent completed audit for their
 * own company's registered site, and nothing else. There is deliberately no URL
 * input here — clients cannot audit arbitrary domains.
 */
export const dynamic = "force-dynamic";

function Empty({ message }: { message: string }) {
  return (
    <ClientAccessFlowGate>
      <ClientPortalFrame eyebrow="SEO" title="SEO audit">
        <ClientEmptyState title="No SEO audit available yet" message={message} />
      </ClientPortalFrame>
    </ClientAccessFlowGate>
  );
}

export default async function ClientSeoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await requireEnabledClientNav("seo");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const admin = createAdminClient();
  const viewer = await resolvePortalViewer(supabase as any, {
    userId: user.id,
    role: profile?.role ?? null,
  });
  const companyIds = viewer.companyIds;

  if (!viewer.staff && !companyIds.length) {
    return (
      <Empty message="Your account is not linked to a company yet. Please contact your account manager." />
    );
  }

  let siteQuery = admin
    .from("seo_sites")
    .select("id, domain")
    .eq("is_client_visible", true)
    .order("last_run_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (companyIds.length) siteQuery = siteQuery.in("company_id", companyIds);

  const { data: site } = await siteQuery.maybeSingle();

  if (!site) {
    return (
      <Empty message="There is no SEO audit shared with your account yet. Your account manager will publish one here when it is ready." />
    );
  }

  const { data: latestRun } = await admin
    .from("seo_runs")
    .select("id")
    .eq("site_id", (site as { id: string }).id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun) {
    return (
      <Empty message="An audit has been set up for your site but has not finished yet. Please check back shortly." />
    );
  }

  const bundle = await loadSeoRun((latestRun as { id: string }).id, {
    includePages: false,
  });
  if (!bundle) {
    return <Empty message="This audit could not be loaded. Please contact your account manager." />;
  }

  return (
    <ClientAccessFlowGate>
      <div className="flex-1 overflow-y-auto bg-background">
        <ReportDocument bundle={bundle} />
      </div>
    </ClientAccessFlowGate>
  );
}
