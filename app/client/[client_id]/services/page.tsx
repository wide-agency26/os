import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);
  
  if (!access) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  // Placeholder static data to fulfill the UI requirement for the Active Service Deliveries List
  const services = [
    {
      category: "Website Development",
      progress: 68,
      milestone: "Phase 3: Development",
      tasks: [
        { name: "Global Design System", status: "completed" },
        { name: "Homepage Layout", status: "completed" },
        { name: "Service Pages", status: "in-progress" },
        { name: "Content Migration", status: "pending" },
      ]
    },
    {
      category: "SEO Optimization",
      progress: 25,
      milestone: "Phase 1: Discovery",
      tasks: [
        { name: "Technical Audit", status: "completed" },
        { name: "Keyword Research", status: "in-progress" },
        { name: "On-page Optimizations", status: "pending" },
      ]
    }
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8 px-4 page-enter">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Active Services</h1>
        <p className="mt-1 text-sm text-zinc-400">High-signal tracker for your promised WIDE packages.</p>
      </header>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Promised Service Category</th>
                <th className="px-6 py-4">Active Sprint Phase Progress</th>
                <th className="px-6 py-4">Target Milestone Delivery</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {services.map((svc, i) => (
                <tr key={i} className="transition-colors hover:bg-zinc-900/50 group">
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-200">{svc.category}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-300 w-8">{svc.progress}%</span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-[#00FF00]"
                          style={{ width: `${svc.progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{svc.milestone}</td>
                  <td className="px-6 py-4">
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-[#00FF00] hover:underline list-none">
                        View Tasks
                      </summary>
                      <div className="mt-4 space-y-2 pl-2 border-l border-zinc-800">
                        {svc.tasks.map((task, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs">
                            {task.status === 'completed' && <span className="text-[#00FF00]">✓</span>}
                            {task.status === 'in-progress' && <span className="text-blue-400">↻</span>}
                            {task.status === 'pending' && <span className="text-zinc-600">○</span>}
                            <span className={task.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}>
                              {task.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
