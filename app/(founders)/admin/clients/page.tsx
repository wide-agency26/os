import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import Link from "next/link";
import { adminPaths } from "@/lib/wide-os/paths";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";
import { CreateWorkspaceForm, DeleteWorkspaceButton } from "./ClientForms";

export default async function FounderClientsPage() {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const supabase = await createClient();
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, company_name, lifecycle_status, estimated_value, current_phase, actual_revenue, current_tier, contact_name")
    .order("company_name", { ascending: true });

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
      <ContextExplainer
        title="CLIENT OPERATIONS DECK"
        description="Comprehensive administrative data grid tracking all client tiers, statuses, and configuration parameters."
        storageKey="admin-clients-deck"
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-50">Client Roster</h2>
          <CreateWorkspaceForm />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Package Tier</th>
                <th className="px-6 py-4">Phase</th>
                <th className="px-6 py-4">Value</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {workspaces?.map((ws) => (
                <tr key={ws.id} className="transition-colors hover:bg-zinc-900/50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-200">{ws.company_name}</p>
                    {ws.contact_name && <p className="mt-1 text-xs text-zinc-500">{ws.contact_name}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ws.lifecycle_status === 'Active' ? 'bg-[#00FF00]/10 text-[#00FF00]' : 'bg-zinc-800 text-zinc-400'}`}>
                      {ws.lifecycle_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{ws.current_tier || "N/A"}</td>
                  <td className="px-6 py-4 text-zinc-300">Phase {ws.current_phase}</td>
                  <td className="px-6 py-4 text-zinc-300">${(ws.estimated_value || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={adminPaths.clientDetails(ws.id)}
                        className="text-xs font-semibold text-[#00FF00] hover:underline"
                      >
                        Manage &rarr;
                      </Link>
                      <span className="text-zinc-800">|</span>
                      <Link
                        href={`/admin/clients/${ws.id}/reports`}
                        className="text-xs font-semibold text-zinc-300 hover:text-white"
                      >
                        Reports
                      </Link>
                      <span className="text-zinc-800">|</span>
                      <DeleteWorkspaceButton id={ws.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {workspaces?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No clients available.
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
