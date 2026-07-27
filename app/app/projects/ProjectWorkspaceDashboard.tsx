"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Section } from "@/components/frappe-ui/Workspace";
import { Briefcase, CheckSquare, Clock } from "lucide-react";

export function ProjectWorkspaceDashboard() {
  const [activeProjects, setActiveProjects] = useState(0);
  const [openTasks, setOpenTasks] = useState(0);
  const [unbilledHours, setUnbilledHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const supabase = createClient();

      // Fetch active projects count
      const { count: projCount } = await (supabase as any)
        .from("projects")
        .select("*", { count: 'exact', head: true })
        .eq("status", "running");
      
      setActiveProjects(projCount || 0);

      // Fetch open tasks
      const { count: taskCount } = await (supabase as any)
        .from("erp_tasks")
        .select("*", { count: 'exact', head: true })
        .neq("status", "Done");
      
      setOpenTasks(taskCount || 0);

      // Fetch unbilled timesheets (Draft, Submitted, Approved, but not Billed)
      const { data: timesheets } = await (supabase as any)
        .from("erp_timesheets")
        .select("hours")
        .eq("is_billable", true)
        .neq("status", "Billed");
      
      const unbilled = timesheets?.reduce((sum: number, ts: any) => sum + Number(ts.hours), 0) || 0;
      setUnbilledHours(unbilled);

      setLoading(false);
    }
    
    fetchStats();
  }, []);

  return (
    <Section title="Quick Stats">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
        <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all flex items-center justify-between group">
          <div>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Active Projects</p>
            {loading ? <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div> : <h3 className="text-3xl font-semibold text-gray-900">{activeProjects}</h3>}
          </div>
          <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Briefcase size={20} />
          </div>
        </div>
        <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all flex items-center justify-between group">
          <div>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Open Tasks</p>
            {loading ? <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div> : <h3 className="text-3xl font-semibold text-gray-900">{openTasks}</h3>}
          </div>
          <div className="w-10 h-10 rounded bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <CheckSquare size={20} />
          </div>
        </div>
        <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all flex items-center justify-between group">
          <div>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Unbilled Hours</p>
            {loading ? <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div> : <h3 className="text-3xl font-semibold text-gray-900">{unbilledHours.toFixed(1)}</h3>}
          </div>
          <div className="w-10 h-10 rounded bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
            <Clock size={20} />
          </div>
        </div>
      </div>
    </Section>
  );
}
