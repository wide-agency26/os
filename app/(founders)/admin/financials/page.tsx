import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";

export default async function FounderFinancialsPage() {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const supabase = await createClient();
  const { data: costs } = await supabase
    .from("finance_identified_costs")
    .select("*")
    .order("date_received", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
      <ContextExplainer
        title="SYSTEM FINANCIAL LEDGER"
        description="Global incoming client invoices, tool overhead trackers, and standard project runway tracking."
        storageKey="admin-financials-deck"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Total Tool Overhead</p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">$2,450 / mo</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Pending Invoices</p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">$14,200</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-50">Identified Costs & Overheads</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Project / Recipient</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {costs?.map((cost) => (
                <tr key={cost.id} className="transition-colors hover:bg-zinc-900/50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-200">{cost.project_name || "Internal"}</p>
                    <p className="mt-1 text-xs text-zinc-500">{cost.paid_for}</p>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{cost.notes || "-"}</td>
                  <td className="px-6 py-4 font-mono text-[#00FF00]">
                    ${(cost.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-zinc-300 capitalize">{cost.recurrence?.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-zinc-300">{cost.date_received}</td>
                </tr>
              ))}
              {costs?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    No costs identified.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
