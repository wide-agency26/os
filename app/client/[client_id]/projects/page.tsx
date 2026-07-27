import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { resolveClientLayoutAccess } from "@/lib/client/resolve-client-layout-access";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";

export default async function ClientProjectsPage({
  params,
}: {
  params: Promise<{ client_id: string }>;
}) {
  const { client_id } = await params;
  const access = await resolveClientLayoutAccess(client_id);
  if (!access) return notFound();

  const supabase = await createClient();

  // Fetch client tasks (using any until types are generated)
  const { data: tasks } = await supabase
    .from("erp_tasks" as any)
    .select("*, assigned_to ( full_name )")
    .eq("workspace_id", client_id)
    .order("created_at", { ascending: false });

  // Compute stats
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t: any) => t.status === "Done").length || 0;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8 px-4">
      <ContextExplainer
        title="PROJECT TRACKING"
        description="Monitor the progress of your active projects, deliverables, and tasks being executed by the WIDE team."
        storageKey="client-projects-deck"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Overall Progress</p>
          <div className="mt-2 flex items-baseline space-x-2">
            <p className="text-3xl font-bold text-[#00FF00]">{progressPercent}%</p>
            <p className="text-sm text-zinc-500">completed</p>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-[#00FF00]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Tasks Overview</p>
          <div className="mt-2 flex space-x-6">
            <div>
              <p className="text-2xl font-bold text-zinc-50">{completedTasks}</p>
              <p className="text-xs text-zinc-500">Done</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-50">{totalTasks - completedTasks}</p>
              <p className="text-xs text-zinc-500">In Progress</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-50">Active Deliverables</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Task</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {tasks?.map((task: any) => (
                <tr key={task.id} className="transition-colors hover:bg-zinc-900/50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-200">{task.title}</p>
                    {task.description && <p className="text-xs text-zinc-500 mt-1">{task.description}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      task.status === 'Done' ? 'bg-green-500/10 text-green-400' :
                      task.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400' :
                      task.status === 'Review' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'TBD'}
                  </td>
                </tr>
              ))}
              {(!tasks || tasks.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                    No active tasks right now.
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
