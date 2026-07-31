"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Section } from "@/components/frappe-ui/Workspace";
import { CheckCircle, Clock, DollarSign, Activity, Edit2 } from "lucide-react";
import FrappeGantt from "@/components/FrappeGantt";
import { Plus, Trash, Users, Mail, Calendar as CalendarIcon, CheckSquare } from "lucide-react";
import Link from "next/link";

export function ProjectDetailDashboard({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskDependencies, setTaskDependencies] = useState<any[]>([]);
  const [timesheetRecords, setTimesheetRecords] = useState<any[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<any[]>([]);
  const [invoiceRecords, setInvoiceRecords] = useState<any[]>([]);
  const [projectUsers, setProjectUsers] = useState<any[]>([]);
  const [projectUpdates, setProjectUpdates] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

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
  
  // New User Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserRole, setNewUserRole] = useState("Member");
  const [newUserId, setNewUserId] = useState("");

  // Google Workspace Context State
  const [workspaceContext, setWorkspaceContext] = useState<any>({ emails: [], events: [], tasks: [] });
  const [fetchingContext, setFetchingContext] = useState(false);
  const [contextError, setContextError] = useState("");

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
          id, title, status, priority, progress, expected_start_date, expected_end_date, expected_time, weight, is_milestone,
          assignee:assigned_to ( full_name )
        `)
        .eq("project_id", projectId);

      // Fetch Task Dependencies
      const { data: depsData } = await (supabase as any)
        .from("erp_task_dependencies")
        .select(`task_id, depends_on_task_id`);
      setTaskDependencies(depsData || []);

      const taskCount = fetchedTasks?.length || 0;
      const completedTaskCount = fetchedTasks?.filter((t: any) => t.status === "Done").length || 0;
      
      let completionPercentage = 0;
      const completionMethod = projData?.completion_method || "Task Completion";
      
      if (completionMethod === "Manual") {
        completionPercentage = Number(projData?.percent_complete || 0);
      } else if (completionMethod === "Task Completion" && taskCount > 0) {
        completionPercentage = Math.round((completedTaskCount / taskCount) * 100);
      } else if (completionMethod === "Task Progress" && taskCount > 0) {
        const sumProgress = fetchedTasks?.reduce((acc: number, t: any) => acc + Number(t.progress || 0), 0) || 0;
        completionPercentage = Math.round(sumProgress / taskCount);
      } else if (completionMethod === "Task Weight" && taskCount > 0) {
        const totalWeight = fetchedTasks?.reduce((acc: number, t: any) => acc + Number(t.weight || 0), 0) || 0;
        if (totalWeight > 0) {
          const sumWeightedProgress = fetchedTasks?.reduce((acc: number, t: any) => acc + (Number(t.progress || 0) * Number(t.weight || 0)), 0) || 0;
          completionPercentage = Math.round(sumWeightedProgress / totalWeight);
        }
      }
      
      setTasks(fetchedTasks || []);

      // Fetch Project Users
      const { data: pUsers } = await (supabase as any)
        .from("erp_project_users")
        .select(`id, project_role, user:user_id ( id, full_name, email )`)
        .eq("project_id", projectId);
      setProjectUsers(pUsers || []);

      // Fetch All Profiles (for assigning new users)
      const { data: allProfiles } = await supabase.from("profiles").select("id, full_name").order("full_name");
      setAllUsers(allProfiles || []);

      // Fetch Project Updates
      const { data: updates } = await (supabase as any)
        .from("erp_project_updates")
        .select(`id, update_date, status, progress_snapshot, summary, created_by_profile:created_by ( full_name )`)
        .eq("project_id", projectId)
        .order("update_date", { ascending: false });
      setProjectUpdates(updates || []);

      // Fetch Timesheets
      const { data: timesheets } = await (supabase as any)
        .from("erp_timesheets")
        .select(`
          id, log_date, hours, billing_rate, note, 
          employee:employee_id ( full_name )
        `)
        .eq("project_id", projectId)
        .order("log_date", { ascending: false });
      
      setTimesheetRecords(timesheets || []);

      let actualStartDate = null;
      let actualEndDate = null;
      let timesheetCost = 0;

      if (timesheets && timesheets.length > 0) {
        // since they are ordered desc, last one is first date
        actualStartDate = timesheets[timesheets.length - 1].log_date;
        actualEndDate = timesheets[0].log_date;
        
        timesheetCost = timesheets.reduce((acc: number, ts: any) => {
          return acc + (Number(ts.hours) * Number(ts.billing_rate || 0));
        }, 0);
      }

      // Fetch Expenses
      const { data: expenses } = await (supabase as any)
        .from("erp_expenses")
        .select(`
          id, expense_date, expense_type, amount, status
        `)
        .eq("project_id", projectId)
        .order("expense_date", { ascending: false });
      
      setExpenseRecords(expenses || []);
      const expenseCost = expenses?.reduce((acc: number, exp: any) => acc + Number(exp.amount), 0) || 0;
      const totalCost = timesheetCost + expenseCost;

      // Fetch Invoices
      const { data: invoices } = await (supabase as any)
        .from("erp_invoices")
        .select(`
          id, title, issue_date, grand_total, status
        `)
        .eq("project_id", projectId)
        .neq("status", "Cancelled")
        .neq("status", "Draft")
        .order("issue_date", { ascending: false });
      
      setInvoiceRecords(invoices || []);
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

  // Fetch Workspace Context when tab is clicked
  useEffect(() => {
    if (activeTab === "Workspace Context" && project && !workspaceContext.emails.length && !workspaceContext.events.length && !workspaceContext.tasks.length) {
      async function fetchContext() {
        setFetchingContext(true);
        try {
          const res = await fetch(`/api/integrations/google/context?query=${encodeURIComponent(project.title)}`);
          if (res.ok) {
            const data = await res.json();
            setWorkspaceContext(data);
          } else if (res.status === 404) {
            setContextError("Google Workspace not connected. Connect it in Project Settings.");
          } else {
            setContextError("Failed to fetch Workspace context.");
          }
        } catch (e) {
          setContextError("Error fetching context.");
        }
        setFetchingContext(false);
      }
      fetchContext();
    }
  }, [activeTab, project]);

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

  const handleAddUser = async () => {
    if (!newUserId) return;
    const supabase = createClient();
    const { error } = await (supabase as any).from("erp_project_users").insert({
      project_id: projectId,
      user_id: newUserId,
      project_role: newUserRole,
    });
    if (!error) {
      setShowAddUser(false);
      setNewUserId("");
      // Fetch again to update state
      const { data } = await (supabase as any).from("erp_project_users")
        .select(`id, project_role, user:user_id ( id, full_name, email )`)
        .eq("project_id", projectId);
      setProjectUsers(data || []);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (!confirm("Remove this user from the project?")) return;
    const supabase = createClient();
    await (supabase as any).from("erp_project_users").delete().eq("id", id);
    setProjectUsers(prev => prev.filter(u => u.id !== id));
  };

  if (!project) {
    return <div className="text-gray-500">Project not found.</div>;
  }

  // Format Gantt Tasks
  const ganttTasks = tasks.map(t => {
    const deps = taskDependencies.filter(d => d.task_id === t.id).map(d => d.depends_on_task_id).join(",");
    // Frappe Gantt requires YYYY-MM-DD
    const start = t.expected_start_date || project.expected_start_date || new Date().toISOString().slice(0, 10);
    const end = t.expected_end_date || start;
    
    return {
      id: t.id,
      name: t.title,
      start,
      end,
      progress: Number(t.progress || 0),
      dependencies: deps,
      custom_class: t.is_milestone ? 'gantt-milestone' : ''
    };
  });

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
            <Link href={`/app/projects/project/${projectId}`} className="px-4 py-2 bg-white border border-gray-300 rounded text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
              <Edit2 size={14} /> Edit Project
            </Link>
            <Link href={`/app/projects/task/new?project=${projectId}`} className="px-4 py-2 bg-white border border-gray-300 rounded text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Add Task
            </Link>
            <Link href={`/app/projects/timesheet/new?project=${projectId}`} className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors">
              Log Time
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto min-w-max pb-1">
          {["Dashboard", "Tasks", "Gantt Chart", "Users", "Updates", "Timesheets", "Financials", "Files", "Workspace Context"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors shrink-0 ${
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
                    {columnTasks.map(t => {
                      const deps = taskDependencies.filter(d => d.task_id === t.id);
                      return (
                        <Link href={`/app/projects/task/${t.id}`} key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-blue-400 hover:shadow transition-all cursor-pointer block">
                          <h4 className="font-medium text-gray-900 mb-2 leading-snug flex items-center gap-2">
                            {t.title}
                            {t.is_milestone && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded uppercase font-bold tracking-wider">MS</span>}
                          </h4>
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
                          {deps.length > 0 && (
                            <div className="mt-2 text-[10px] text-gray-400">Depends on {deps.length} task(s)</div>
                          )}
                        </Link>
                      );
                    })}
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

        {/* Tab Content: Gantt Chart */}
        {activeTab === "Gantt Chart" && (
          <div className="min-h-[400px]">
             <FrappeGantt tasks={ganttTasks} viewMode="Day" />
          </div>
        )}

        {/* Tab Content: Users */}
        {activeTab === "Users" && (
          <div>
            <div className="flex justify-end mb-4">
               {!showAddUser ? (
                 <button onClick={() => setShowAddUser(true)} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[13px] font-medium rounded flex items-center gap-2 hover:bg-blue-100 transition-colors">
                   <Plus size={14} /> Add User
                 </button>
               ) : (
                 <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                   <select value={newUserId} onChange={e => setNewUserId(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-[13px] bg-white">
                     <option value="">Select User...</option>
                     {allUsers.filter(u => !projectUsers.some(pu => pu.user?.id === u.id)).map(u => (
                       <option key={u.id} value={u.id}>{u.full_name}</option>
                     ))}
                   </select>
                   <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-[13px] bg-white">
                     <option value="Member">Member</option>
                     <option value="Manager">Manager</option>
                     <option value="Viewer">Viewer</option>
                   </select>
                   <button onClick={handleAddUser} className="px-3 py-1.5 bg-blue-600 text-white rounded text-[13px] font-medium">Add</button>
                   <button onClick={() => setShowAddUser(false)} className="px-3 py-1.5 text-gray-500 hover:bg-gray-200 rounded text-[13px] font-medium">Cancel</button>
                 </div>
               )}
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {projectUsers.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">No users assigned.</td></tr>
                  ) : (
                    projectUsers.map(u => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                            {u.user?.full_name?.charAt(0) || "U"}
                          </div>
                          {u.user?.full_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.user?.email}</td>
                        <td className="px-4 py-3 text-gray-600">{u.project_role}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleRemoveUser(u.id)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Updates */}
        {activeTab === "Updates" && (
           <div className="space-y-4">
             <div className="flex justify-end">
               <Link href="/app/projects/project-update/new" className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[13px] font-medium rounded flex items-center gap-2 hover:bg-blue-100 transition-colors">
                 <Plus size={14} /> New Update
               </Link>
             </div>
             {projectUpdates.length === 0 ? (
               <div className="p-8 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">No updates posted yet.</div>
             ) : (
               projectUpdates.map(u => (
                 <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                   <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
                     <div className="flex items-center gap-3">
                       <span className="font-bold text-gray-900">{new Date(u.update_date).toLocaleDateString()}</span>
                       <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                         u.status === 'On Track' ? 'bg-green-100 text-green-700' :
                         u.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                         'bg-orange-100 text-orange-700'
                       }`}>{u.status}</span>
                     </div>
                     <span className="text-[12px] text-gray-500 font-medium">{u.progress_snapshot}% Complete</span>
                   </div>
                   <div className="text-[13px] text-gray-700 whitespace-pre-wrap">{u.summary || "No summary provided."}</div>
                   <div className="mt-3 text-[11px] text-gray-400 font-medium">Posted by {u.created_by_profile?.full_name}</div>
                 </div>
               ))
             )}
           </div>
        )}

        {/* Tab Content: Timesheets */}
        {activeTab === "Timesheets" && (
           <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
             {timesheetRecords.length === 0 ? (
               <div className="p-8 text-center text-gray-500">No timesheets logged for this project.</div>
             ) : (
               <table className="w-full text-left text-[13px]">
                 <thead className="bg-gray-50 border-b border-gray-200">
                   <tr>
                     <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                     <th className="px-4 py-3 font-medium text-gray-600">Employee</th>
                     <th className="px-4 py-3 font-medium text-gray-600">Hours</th>
                     <th className="px-4 py-3 font-medium text-gray-600">Cost</th>
                     <th className="px-4 py-3 font-medium text-gray-600">Note</th>
                   </tr>
                 </thead>
                 <tbody>
                   {timesheetRecords.map(ts => (
                     <tr key={ts.id} className="border-b border-gray-100 hover:bg-gray-50">
                       <td className="px-4 py-3 font-medium text-gray-900">
                         <Link href={`/app/projects/timesheet/${ts.id}`} className="hover:underline hover:text-blue-600">
                           {ts.log_date}
                         </Link>
                       </td>
                       <td className="px-4 py-3 text-gray-600">{ts.employee?.full_name || "-"}</td>
                       <td className="px-4 py-3 text-gray-600">{ts.hours}</td>
                       <td className="px-4 py-3 text-gray-600">{formatCurrency(ts.hours * (ts.billing_rate || 0))}</td>
                       <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{ts.note || "-"}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
           </div>
        )}

        {/* Tab Content: Financials */}
        {activeTab === "Financials" && (
           <div className="space-y-8">
             <Section title="Invoices">
               <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                 {invoiceRecords.length === 0 ? (
                   <div className="p-8 text-center text-gray-500">No invoices generated for this project.</div>
                 ) : (
                   <table className="w-full text-left text-[13px]">
                     <thead className="bg-gray-50 border-b border-gray-200">
                       <tr>
                         <th className="px-4 py-3 font-medium text-gray-600">Invoice ID</th>
                         <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                         <th className="px-4 py-3 font-medium text-gray-600">Amount</th>
                         <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                       </tr>
                     </thead>
                     <tbody>
                       {invoiceRecords.map(inv => (
                         <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                           <td className="px-4 py-3 font-medium text-gray-900">
                             <Link href={`/app/accounting/sales-invoice/${inv.id}`} className="hover:underline hover:text-blue-600">
                               {inv.title || inv.id.split('-')[0]}
                             </Link>
                           </td>
                           <td className="px-4 py-3 text-gray-600">{inv.issue_date}</td>
                           <td className="px-4 py-3 text-gray-600">{formatCurrency(inv.grand_total)}</td>
                           <td className="px-4 py-3">
                             <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                               inv.status === 'Paid' ? 'bg-green-100 text-green-700' :
                               inv.status === 'Unpaid' ? 'bg-red-100 text-red-700' :
                               'bg-blue-100 text-blue-700'
                             }`}>
                               {inv.status}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 )}
               </div>
             </Section>
             
             <Section title="Expenses">
               <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                 {expenseRecords.length === 0 ? (
                   <div className="p-8 text-center text-gray-500">No expenses logged for this project.</div>
                 ) : (
                   <table className="w-full text-left text-[13px]">
                     <thead className="bg-gray-50 border-b border-gray-200">
                       <tr>
                         <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                         <th className="px-4 py-3 font-medium text-gray-600">Type</th>
                         <th className="px-4 py-3 font-medium text-gray-600">Amount</th>
                         <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                       </tr>
                     </thead>
                     <tbody>
                       {expenseRecords.map(exp => (
                         <tr key={exp.id} className="border-b border-gray-100 hover:bg-gray-50">
                           <td className="px-4 py-3 font-medium text-gray-900">
                             <Link href={`/app/accounting/expense/${exp.id}`} className="hover:underline hover:text-blue-600">
                               {exp.expense_date}
                             </Link>
                           </td>
                           <td className="px-4 py-3 text-gray-600">{exp.expense_type || "-"}</td>
                           <td className="px-4 py-3 text-gray-600">{formatCurrency(exp.amount)}</td>
                           <td className="px-4 py-3">
                             <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                               exp.status === 'Approved' ? 'bg-green-100 text-green-700' :
                               exp.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                               'bg-yellow-100 text-yellow-700'
                             }`}>
                               {exp.status || "Pending"}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 )}
               </div>
             </Section>
           </div>
        )}

        {/* Tab Content: Files */}
        {activeTab === "Files" && (
           <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500 shadow-sm">
             Document management integration coming soon.
           </div>
        )}

        {/* Tab Content: Workspace Context */}
        {activeTab === "Workspace Context" && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm mb-4">
              <strong>Dynamic Context Feed:</strong> Showing recent Google Workspace activity related to <strong>"{project.title}"</strong>.
            </div>

            {contextError ? (
              <div className="p-8 text-center text-red-500 bg-red-50 border border-red-200 rounded-lg">
                {contextError}
                {contextError.includes("not connected") && (
                  <div className="mt-4">
                    <Link href="/app/projects/settings" className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors">
                      Go to Settings
                    </Link>
                  </div>
                )}
              </div>
            ) : fetchingContext ? (
              <div className="p-12 text-center text-gray-500 animate-pulse">
                Fetching secure context from Google Workspace...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Emails */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col h-[500px]">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <h3 className="font-bold text-gray-800 text-[13px]">Recent Emails</h3>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {workspaceContext.emails.length === 0 ? (
                      <p className="text-[12px] text-gray-500 text-center py-4">No recent emails found.</p>
                    ) : (
                      workspaceContext.emails.map((m: any) => (
                        <div key={m.id} className="border border-gray-100 p-3 rounded bg-gray-50">
                          <h4 className="font-semibold text-gray-900 text-[12px] truncate">{m.subject || "No Subject"}</h4>
                          <p className="text-[11px] text-gray-500 mt-1 truncate">From: {m.from}</p>
                          <p className="text-[11px] text-gray-600 mt-2 line-clamp-2">{m.snippet}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Calendar */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col h-[500px]">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    <CalendarIcon size={16} className="text-gray-500" />
                    <h3 className="font-bold text-gray-800 text-[13px]">Upcoming Events</h3>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {workspaceContext.events.length === 0 ? (
                      <p className="text-[12px] text-gray-500 text-center py-4">No upcoming events.</p>
                    ) : (
                      workspaceContext.events.map((e: any) => (
                        <a key={e.id} href={e.link} target="_blank" rel="noreferrer" className="block border border-gray-100 p-3 rounded bg-gray-50 hover:border-blue-300 transition-colors">
                          <h4 className="font-semibold text-gray-900 text-[12px] truncate">{e.summary}</h4>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {new Date(e.start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </a>
                      ))
                    )}
                  </div>
                </div>

                {/* Tasks */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col h-[500px]">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    <CheckSquare size={16} className="text-gray-500" />
                    <h3 className="font-bold text-gray-800 text-[13px]">Google Tasks</h3>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {workspaceContext.tasks.length === 0 ? (
                      <p className="text-[12px] text-gray-500 text-center py-4">No related tasks found.</p>
                    ) : (
                      workspaceContext.tasks.map((t: any) => (
                        <div key={t.id} className="border border-gray-100 p-3 rounded bg-gray-50 flex items-start gap-2">
                          <input type="checkbox" disabled checked={t.status === 'completed'} className="mt-0.5 rounded border-gray-300 text-blue-600" />
                          <div>
                            <h4 className="font-semibold text-gray-900 text-[12px]">{t.title}</h4>
                            {t.due && <p className="text-[10px] text-gray-500 mt-1">Due: {new Date(t.due).toLocaleDateString()}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
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
