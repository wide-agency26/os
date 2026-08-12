import Link from "next/link";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { hasLexwareCredentials } from "@/lib/bd/lexware";
import { mergeQuotation } from "@/lib/bd/quotation";

export default async function QuotationHubPage() {
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
        <p className="text-red-600 font-medium">Access denied.</p>
      </Workspace>
    );
  }

  const configured = hasLexwareCredentials();
  const { data: rows } = await supabase
    .from("bd_records")
    .select("id, name, company_name, stage, quotation, updated_at")
    .in("stage", ["quotation", "contract", "client_won"])
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <Workspace wide>
      <div className="space-y-6 py-2 max-w-3xl">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Business Development
          </p>
          <h1 className="text-2xl font-semibold text-gray-950">Quotations</h1>
          <p className="mt-1 text-sm text-gray-600">
            Lexware contact sync + quotations.{" "}
            {configured ? (
              <span className="text-emerald-700 font-medium">API connected.</span>
            ) : (
              <span className="text-amber-700 font-medium">
                Coming soon — add LEXWARE_API_KEY.
              </span>
            )}
          </p>
        </div>

        <ul className="space-y-2">
          {(rows ?? []).map((r) => {
            const q = mergeQuotation(
              (r.quotation as Record<string, unknown>) || {}
            );
            return (
              <li key={r.id}>
                <Link
                  href={`/app/bd/quotation/${r.id}`}
                  className="block rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-400"
                >
                  <p className="font-semibold text-gray-950">
                    {r.company_name} · {r.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Stage {r.stage} · Quotation {q.status}
                    {q.placeholder ? " · placeholder" : ""}
                  </p>
                </Link>
              </li>
            );
          })}
          {(rows ?? []).length === 0 && (
            <p className="text-sm text-gray-500">
              No records in quotation-adjacent stages yet.
            </p>
          )}
        </ul>
      </div>
    </Workspace>
  );
}
