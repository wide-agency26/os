import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { SeoAuditReportView } from "@/components/seo-audit/SeoAuditUI";
import { getSeoAudit } from "@/app/actions/seo-audit";

export default async function SeoAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const result = await getSeoAudit(id);
  if (!result.ok || !result.audit) {
    if (result.error === "Not found") notFound();
    return (
      <Workspace>
        <p className="text-sm text-red-600">{result.error}</p>
      </Workspace>
    );
  }

  const audit = result.audit;

  return (
    <Workspace>
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <Link href="/app/seo-audit" className="text-gray-500 hover:text-gray-900">
          ← All audits
        </Link>
        {audit.bd_record_id && (
          <Link
            href={`/app/bd/${audit.bd_record_id}`}
            className="text-violet-700 hover:underline"
          >
            Open BD record
          </Link>
        )}
        {audit.status === "ready" && (
          <a
            href={`/a/${audit.public_slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 hover:underline"
          >
            Public share /a/{audit.public_slug}
          </a>
        )}
      </div>
      {audit.status === "failed" ? (
        <p className="text-sm text-red-600">{audit.error_message}</p>
      ) : (
        <SeoAuditReportView
          audit={audit}
          sharePath={`/a/${audit.public_slug}`}
        />
      )}
    </Workspace>
  );
}
