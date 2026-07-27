"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Section } from "@/components/frappe-ui/Workspace";
import { CheckCircle, Clock, DollarSign, Activity } from "lucide-react";
import Link from "next/link";

export function ProjectDetailDashboard({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    completionPercentage: 0,
    totalCost: 0,
    totalBilled: 0,
    actualStartDate: null as string | null,
    actualEndDate: null as string | null,
    taskCount: 0,
    completedTaskCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");

  useEffect(() => {
    async function fetchProjectDetails() {
      setLoading(true);
      const supabase = createClient();

      // Fetch Project
      const { data: projData } = await (supabase as any)
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      
      if (projData) setProject(projData);

      // Fetch Full Tasks
      const { data: fetchedTasks } = await (supabase as any)
        .from("erp_tasks")
        .select(`
          id, title, status, priority, progress, due_date,
          assignee:assigned_to ( full_name )
        `)
        .eq("project_id", projectId);

      const taskCount = fetchedTasks?.length || 0;
      const completedTaskCount = fetchedTasks?.filter((t: any) => t.status === "Done").length || 0;
      const completionPercentage = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;
      
      setTasks(fetchedTasks || []);

      // Fetch Timesheets for Costing and Timeline
      const { data: timesheets } = await (supabase as any)
        .from("erp_timesheets")
        .select("log_date, hours, billing_rate")
        .eq("project_id", projectId)
        .order("log_date", { ascending: true });
      
      let actualStartDate = null;
      let actualEndDate = null;
      let timesheetCost = 0;

      if (timesheets && timesheets.length > 0) {
        actualStartDate = timesheets[0].log_date;
        actualEndDate = timesheets[timesheets.length - 1].log_date;
        
        timesheetCost = timesheets.reduce((acc: number, ts: any) => {
          return acc + (Number(ts.hours) * Number(ts.billing_rate || 0));
        }, 0);
      }

      // Fetch Expenses for Costing
      const { data: expenses } = await (supabase as any)
        .from("erp_expenses")
        .select("amount")
        .eq("project_id", projectId);
      
      const expenseCost = expenses?.reduce((acc: number, exp: any) => acc + Number(exp.amount), 0) || 0;
      const totalCost = timesheetCost + expenseCost;

      // Fetch Invoices for Billing
      const { data: invoices } = await (supabase as any)
        .from("erp_invoices")
        .select("grand_total")
        .eq("project_id", projectId)
        .neq("status", "Cancelled")
        .neq("status", "Draft");
      
      const totalBilled = invoices?.reduce((acc: number, inv: any) => acc + Number(inv.grand_total), 0) || 0;

      setStats({
        completionPercentage,
        totalCost,
        totalBilled,
        actualStartDate,
        actualEndDate,
        taskCount,
        completedTaskCount
      });

      setLoading(false);
    }

    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-8">
        <div className="h-10 w-1/3 bg-gray-200 rounded"></div>
        <div className="h-40 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!project) {
    return <div className="text-gray-500">Project not found.</div>;
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Main Content Area */}
      <div className="flex-1">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{project.title}</h2>
              <span className={`px-2 py-1 text-[11px] font-bold uppercase tracking-wider rounded ${
                project.status === 'completed' ? 'bg-green-100 text-green-700' :
                project.status === 'running' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {project.status}
              </span>
            </div>
            <p className="text-gray-500 mt-1">{project.scope || "No scope provided."}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/app/projects/task/new?project=${projectId}`} className="px-4 py-2 bg-white border border-gray-300 rounded text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Add Task
            </Link>
            <Link href={`/app/projects/timesheet/new?project=${projectId}`} className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors">
              Log Time
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {["Dashboard", "Tasks", "Timesheets", "Files"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content: Dashboard */}
        {activeTab === "Dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Progress */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Progress</p>
                <Activity size={18} className="text-gray-400" />
              </div>
              <div className="flex items-end gap-2 mb-2">
                <h3 className="text-3xl font-semibold text-gray-900 leading-none">{stats.completionPercentage}%</h3>
                <span className="text-sm text-gray-500 mb-1">completed</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.completionPercentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">{stats.completedTaskCount} of {stats.taskCount} tasks done</p>
            </div>

            {/* Timeline */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Timeline</p>
                <Clock size={18} className="text-gray-400" />
              </div>
              <div className="space-y-3 mt-auto flex gap-8">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Actual Start</p>
                  <p className="text-sm font-medium text-gray-900">{stats.actualStartDate ? new Date(stats.actualStartDate).toLocaleDateString() : "Not started"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Actual End</p>
                  <p className="text-sm font-medium text-gray-900">{stats.actualEndDate ? new Date(stats.actualEndDate).toLocaleDateString() : "Ongoing"}</p>
                </div>
              </div>
            </div>

            {/* Costing */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Total Costing</p>
                <DollarSign size={18} className="text-red-400" />
              </div>
              <div className="mt-auto">
                <h3 className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalCost)}</h3>
                <p className="text-xs text-gray-500 mt-1">From Timesheets & Expenses</p>
              </div>
            </div>

            {/* Billing */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Total Billed</p>
                <CheckCircle size={18} className="text-green-500" />
              </div>
              <div className="mt-auto">
                <h3 className="text-2xl font-semibold text-green-600">{formatCurrency(stats.totalBilled)}</h3>
                <p className="text-xs text-gray-500 mt-1">From Invoices</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Tasks */}
        {activeTab === "Tasks" && (
          <div className="flex gap-4 overflow-x-auto min-w-max pb-4 px-1">
            {['Open', 'In Progress', 'Review', 'Done', 'Cancelled'].map((status) => {
              const columnTasks = tasks.filter(t => t.status === status);
              return (
                <div key={status} className="w-80 flex flex-col bg-gray-100/80 rounded-lg border border-gray-200 shrink-0 self-start max-h-[600px]">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between sticky top-0 rounded-t-lg">
                    <h3 className="font-semibold text-gray-700">{status}</h3>
                    <span className="bg-gray-200 text-gray-600 text-[11px] px-2 py-0.5 rounded-full font-medium">{columnTasks.length}</span>
                  </div>
                  <div className="p-3 overflow-y-auto flex flex-col gap-3">
                    {columnTasks.map(t => (
                      <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-blue-400 hover:shadow transition-all cursor-pointer">
                        <h4 className="font-medium text-gray-900 mb-2 leading-snug">{t.title}</h4>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                          <span className="text-[11px] font-medium text-gray-500">
                            {t.assignee?.full_name || 'Unassigned'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            t.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                            t.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                            t.priority === 'Low' ? 'bg-gray-100 text-gray-600' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {t.priority || 'Normal'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Other Tabs Placeholders */}
        {activeTab === "Timesheets" && (
           <div className="p-8 text-center text-gray-500 border border-gray-200 rounded border-dashed">
             Timesheets list will be rendered here.
           </div>
        )}
        {activeTab === "Files" && (
           <div className="p-8 text-center text-gray-500 border border-gray-200 rounded border-dashed">
             Project files and attachments will be rendered here.
           </div>
        )}
      </div>

      {/* Right Sidebar (Related Documents & Status) */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-6">
        
        <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
          <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Related Documents</h4>
          <ul className="space-y-3">
            <li>
              <Link href={`/app/projects/task?project=${projectId}`} className="text-[13px] font-medium text-gray-700 hover:text-blue-600 flex justify-between">
                <span>Tasks</span>
                <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{stats.taskCount}</span>
              </Link>
            </li>
            <li>
              <Link href={`/app/projects/timesheet?project=${projectId}`} className="text-[13px] font-medium text-gray-700 hover:text-blue-600 flex justify-between">
                <span>Timesheets</span>
              </Link>
            </li>
            <li>
              <Link href={`/app/accounting/sales-invoice?project=${projectId}`} className="text-[13px] font-medium text-gray-700 hover:text-blue-600 flex justify-between">
                <span>Sales Invoices</span>
              </Link>
            </li>
            <li>
              <Link href={`/app/accounting/expense?project=${projectId}`} className="text-[13px] font-medium text-gray-700 hover:text-blue-600 flex justify-between">
                <span>Expenses</span>
              </Link>
            </li>
          </ul>
        </div>

        <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
          <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Project Details</h4>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-gray-500">Expected Start</p>
              <p className="text-[13px] font-medium text-gray-900">{project.expected_start_date ? new Date(project.expected_start_date).toLocaleDateString() : "-"}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Expected End</p>
              <p className="text-[13px] font-medium text-gray-900">{project.expected_end_date ? new Date(project.expected_end_date).toLocaleDateString() : "-"}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Department</p>
              <p className="text-[13px] font-medium text-gray-900">{project.department || "-"}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
