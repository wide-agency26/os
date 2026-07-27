import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";
import { Database } from "@/types/supabase";

export default async function FounderTimesPage() {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const supabase = await createClient();
  
  // Using any to bypass TS error before Supabase type generation is run
  const { data: timesheets } = await supabase
    .from("erp_timesheets" as any)
    .select(`
      id,
      log_date,
      hours,
      notes,
      is_billable,
      status,
      person:person_id ( full_name ),
      task:task_id ( title ),
      workspace:workspace_id ( company_name )
    `)
    .order("log_date", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
      <ContextExplainer
        title="TIME & PROJECT TRACKING"
        description="Global view of agency timesheets, billable hours, and task progress."
        storageKey="admin-times-deck"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Total Hours (This Week)</p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">124.5</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Billable Hours</p>
          <p className="mt-2 text-3xl font-bold text-[#00FF00]">89.0</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Pending Approvals</p>
          <p className="mt-2 text-3xl font-bold text-amber-500">12</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-50">Recent Timesheets</h2>
          <button className="text-xs bg-white text-black px-3 py-1 rounded-full font-medium">Log Time</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Team Member</th>
                <th className="px-6 py-4">Client / Project</th>
                <th className="px-6 py-4">Task</th>
                <th className="px-6 py-4">Hours</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {timesheets?.map((sheet: any) => (
                <tr key={sheet.id} className="transition-colors hover:bg-zinc-900/50">
                  <td className="px-6 py-4 font-medium text-zinc-200">{sheet.person?.full_name || "Unknown"}</td>
                  <td className="px-6 py-4 text-zinc-300">{sheet.workspace?.company_name || "-"}</td>
                  <td className="px-6 py-4 text-zinc-300">
                    <p>{sheet.task?.title || "General"}</p>
                    {sheet.notes && <p className="text-xs text-zinc-500 mt-1">{sheet.notes}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-zinc-100">{sheet.hours}</span>
                    {sheet.is_billable && <span className="ml-2 text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">Billable</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      sheet.status === 'Approved' ? 'bg-green-500/10 text-green-400' :
                      sheet.status === 'Submitted' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {sheet.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{new Date(sheet.log_date).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!timesheets || timesheets.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No timesheets logged yet.
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
