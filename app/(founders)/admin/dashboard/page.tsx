import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import Link from "next/link";
import { adminPaths } from "@/lib/wide-os/paths";

export default async function FounderDashboardPage() {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const supabase = await createClient();
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, company_name, lifecycle_status, estimated_value, current_phase, actual_revenue")
    .order("company_name", { ascending: true });

  const activeMRR = workspaces?.filter(w => w.lifecycle_status === 'Active').reduce((sum, w) => sum + (w.estimated_value || 0), 0) || 0;
  
  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Global Admin Cockpit</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Executive summary and complete client status roster.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Active MRR</p>
          <p className="mt-2 text-3xl font-bold text-[#00FF00]">${activeMRR.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Studio Margin</p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">68%</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Cash Runway</p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">14 Mos</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-50">Client Status Roster</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {workspaces?.map((ws) => (
            <div key={ws.id} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-zinc-900/50">
              <div>
                <p className="text-sm font-medium text-zinc-200">{ws.company_name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ws.lifecycle_status === 'Active' ? 'bg-[#00FF00]/10 text-[#00FF00]' : 'bg-zinc-800 text-zinc-400'}`}>
                    {ws.lifecycle_status}
                  </span>
                  <span>•</span>
                  <span>Phase {ws.current_phase}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={adminPaths.clientDetails(ws.id)}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-white"
                >
                  Manage Workspace
                </Link>
              </div>
            </div>
          ))}
          {workspaces?.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">No clients found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
