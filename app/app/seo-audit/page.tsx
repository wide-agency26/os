import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { SeoAuditLauncher } from "@/components/seo-audit/SeoAuditUI";
import { listSeoAudits } from "@/app/actions/seo-audit";

export default async function SeoAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; bd?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return (
      <Workspace>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }

  const recent = await listSeoAudits();

  return (
    <Workspace>
      <SeoAuditLauncher
        initialUrl={sp.url || ""}
        bdRecordId={sp.bd || null}
        recent={recent.audits}
      />
    </Workspace>
  );
}
