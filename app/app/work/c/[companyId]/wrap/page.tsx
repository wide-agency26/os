import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { workPaths } from "@/lib/work/paths";

export default async function WrapBotPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
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
  const { data: company } = await supabase
    .from("crm_customers")
    .select("id, company, name")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) notFound();
  const label = company.company || company.name || "Company";

  return (
    <Workspace>
      <div className="max-w-2xl space-y-6">
        <Link
          href={workPaths.company(companyId)}
          className="text-xs font-semibold text-gray-500 hover:text-gray-900"
        >
          ← {label}
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Coming soon
          </p>
          <h1 className="text-2xl font-semibold text-gray-950">Wrap bot</h1>
          <p className="mt-2 text-sm text-gray-600">
            Same project as SOW, contract, and the ledger — not a martech tool,
            and not for Lose deals.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-dashed border-gray-300 p-4 opacity-70">
            <h2 className="text-sm font-semibold text-gray-900">Wrap in</h2>
            <p className="mt-1 text-xs text-gray-600">
              After contract confirm: kickoff from the SOW, seed tasks, assign a
              PM, client access. Handover from Win to Live.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 p-4 opacity-70">
            <h2 className="text-sm font-semibold text-gray-900">Wrap out</h2>
            <p className="mt-1 text-xs text-gray-600">
              Close the file: archive, freeze CI, last invoice reminder, recap
              into CRM.
            </p>
          </div>
        </div>
      </div>
    </Workspace>
  );
}
