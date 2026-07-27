import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { resolveClientLayoutAccess } from "@/lib/client/resolve-client-layout-access";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";
import Link from "next/link";

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ client_id: string }>;
}) {
  const { client_id } = await params;
  const access = await resolveClientLayoutAccess(client_id);
  if (!access) return notFound();

  const supabase = await createClient();

  // Fetch client invoices (using any until types are generated)
  const { data: invoices } = await supabase
    .from("erp_invoices" as any)
    .select("*")
    .eq("workspace_id", client_id)
    .order("issue_date", { ascending: false });

  // Compute totals
  const totalDue = invoices
    ?.filter((i: any) => i.status !== "Paid" && i.status !== "Cancelled")
    .reduce((sum: number, i: any) => sum + (i.grand_total - i.amount_paid), 0) || 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8 px-4">
      <ContextExplainer
        title="BILLING & INVOICES"
        description="View your active invoices, payment history, and manage your billing details with WIDE."
        storageKey="client-billing-deck"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Total Outstanding</p>
          <p className="mt-2 text-3xl font-bold text-red-400">${totalDue.toLocaleString()}</p>
          {totalDue > 0 && (
            <button className="mt-4 w-full rounded-lg bg-zinc-100 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
              Make a Payment
            </button>
          )}
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-center">
          <p className="text-sm text-zinc-400">
            For billing inquiries or to update your primary payment method, please contact your account manager.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-50">Invoice History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Issue Date</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {invoices?.map((inv: any) => (
                <tr key={inv.id} className="transition-colors hover:bg-zinc-900/50">
                  <td className="px-6 py-4 font-medium text-zinc-200">{inv.invoice_number}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      inv.status === 'Paid' ? 'bg-green-500/10 text-green-400' :
                      inv.status === 'Overdue' ? 'bg-red-500/10 text-red-400' :
                      inv.status === 'Draft' ? 'bg-zinc-800 text-zinc-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{new Date(inv.issue_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-zinc-300">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4 font-mono text-zinc-100">${inv.grand_total.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <Link href={`/client/${client_id}/billing/${inv.id}`} className="text-[#00FF00] hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {(!invoices || invoices.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No invoices found.
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
