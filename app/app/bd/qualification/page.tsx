import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { listBdRecords } from "@/app/actions/bd";
import { BD_STAGE_LABELS, BD_LEGITIMACY_LABELS } from "@/lib/bd/constants";

export default async function BdQualificationIndexPage() {
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

  const result = await listBdRecords();
  const candidates = (result.records ?? []).filter((r) =>
    ["prospect", "qualifying", "on_hold"].includes(r.stage)
  );

  return (
    <Workspace>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Qualification</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manual legitimacy + demand signals. Open a record to run the shell
            and confirm a recommendation.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-500 px-4 py-6">
              No prospects / qualifying / on-hold records.{" "}
              <Link href="/app/bd" className="text-blue-600 underline">
                Back to board
              </Link>
            </p>
          ) : (
            candidates.map((r) => (
              <Link
                key={r.id}
                href={`/app/bd/qualification/${r.id}?run=1`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {r.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {r.company_name} · {BD_STAGE_LABELS[r.stage]}
                    {r.legitimacy_status
                      ? ` · ${BD_LEGITIMACY_LABELS[r.legitimacy_status]}`
                      : " · legitimacy unset"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-700 shrink-0">
                  Run →
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </Workspace>
  );
}
