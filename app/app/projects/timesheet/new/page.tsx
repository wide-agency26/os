"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Plus, Trash } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function NewTimesheetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("project") || "";

  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  const [header, setHeader] = useState({
    employee_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    status: "Draft",
    note: "",
  });

  const [details, setDetails] = useState<any[]>([
    {
      id: "new-1",
      project_id: initialProjectId,
      task_id: "",
      activity_type_id: "",
      from_time: "",
      to_time: "",
      hours: "",
      is_billable: true,
      billing_rate: 0,
      costing_rate: 0,
      description: "",
    }
  ]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const [
        { data: userData },
        { data: projData },
        { data: taskData },
        { data: activityData }
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("role", ["admin", "superadmin", "client_manager", "bd_manager"]),
        supabase.from("projects").select("id, title").eq("status", "running"),
        (supabase as any).from("erp_tasks").select("id, title, project_id").in("status", ["Open", "In Progress", "Review"]),
        (supabase as any).from("activity_types").select("id, name, default_billing_rate, default_costing_rate")
      ]);

      if (userData) setUsers(userData);
      if (projData) setProjects(projData);
      if (taskData) setTasks(taskData);
      if (activityData) setActivities(activityData);
    }
    fetchData();
  }, []);

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setHeader({ ...header, [e.target.name]: e.target.value });
  };

  const addDetailRow = () => {
    setDetails([
      ...details,
      {
        id: `new-${Date.now()}`,
        project_id: initialProjectId,
        task_id: "",
        activity_type_id: "",
        from_time: "",
        to_time: "",
        hours: "",
        is_billable: true,
        billing_rate: 0,
        costing_rate: 0,
        description: "",
      }
    ]);
  };

  const removeDetailRow = (id: string) => {
    setDetails(details.filter(d => d.id !== id));
  };

  const handleDetailChange = (id: string, field: string, value: any) => {
    setDetails(details.map(d => {
      if (d.id !== id) return d;
      const updated = { ...d, [field]: value };
      
      // Auto-set rates when activity changes
      if (field === "activity_type_id") {
        const activity = activities.find(a => a.id === value);
        if (activity) {
          updated.billing_rate = activity.default_billing_rate || 0;
          updated.costing_rate = activity.default_costing_rate || 0;
        }
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!header.employee_id) {
      alert("Please select an employee.");
      return;
    }
    if (details.length === 0 || details.some(d => !d.project_id || !d.hours)) {
      alert("Please ensure all rows have a Project and Hours specified.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 1. Calculate totals
    const total_hours = details.reduce((sum, d) => sum + Number(d.hours || 0), 0);
    const total_billable_hours = details.filter(d => d.is_billable).reduce((sum, d) => sum + Number(d.hours || 0), 0);
    const total_billable_amount = details.filter(d => d.is_billable).reduce((sum, d) => sum + (Number(d.hours || 0) * Number(d.billing_rate || 0)), 0);
    const total_costing_amount = details.reduce((sum, d) => sum + (Number(d.hours || 0) * Number(d.costing_rate || 0)), 0);

    // 2. Insert Timesheet Header
    // NOTE: erp_timesheets previously used person_id, but the dashboard uses employee_id. Assuming person_id is correct based on original form.
    const { data: ts, error: tsError } = await (supabase as any)
      .from("erp_timesheets")
      .insert([{
        person_id: header.employee_id, // map to person_id for DB schema compat
        start_date: header.start_date,
        end_date: header.end_date,
        log_date: header.start_date, // Keep log_date for backward compat
        status: header.status,
        note: header.note,
        total_hours,
        total_billable_hours,
        total_billable_amount,
        total_costing_amount
      }])
      .select("id")
      .single();

    if (tsError) {
      alert("Error saving timesheet: " + tsError.message);
      setLoading(false);
      return;
    }

    // 3. Insert Details
    const detailPayloads = details.map((d, idx) => ({
      timesheet_id: ts.id,
      project_id: d.project_id || null,
      task_id: d.task_id || null,
      activity_type_id: d.activity_type_id || null,
      from_time: d.from_time ? `${header.start_date}T${d.from_time}:00Z` : null,
      to_time: d.to_time ? `${header.start_date}T${d.to_time}:00Z` : null,
      hours: Number(d.hours),
      is_billable: d.is_billable,
      billing_rate: Number(d.billing_rate),
      costing_rate: Number(d.costing_rate),
      billing_amount: d.is_billable ? (Number(d.hours) * Number(d.billing_rate)) : 0,
      costing_amount: (Number(d.hours) * Number(d.costing_rate)),
      description: d.description,
      sort_order: idx
    }));

    const { error: dError } = await (supabase as any).from("erp_timesheet_details").insert(detailPayloads);
    
    if (dError) {
      alert("Error saving timesheet details: " + dError.message);
    } else {
      router.push(initialProjectId ? `/app/projects/${initialProjectId}` : "/app/projects/timesheet");
    }
    setLoading(false);
  };

  return (
    <Workspace>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">New Timesheet</h2>
              <p className="text-sm text-gray-500 mt-1">Log multiple activities for a time period.</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Save size={16} /> {loading ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="space-y-6">
          <Section title="Overview">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Employee <span className="text-red-500">*</span></label>
                <select name="employee_id" value={header.employee_id} onChange={handleHeaderChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="">Select person...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" name="start_date" value={header.start_date} onChange={handleHeaderChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" name="end_date" value={header.end_date} onChange={handleHeaderChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Status</label>
                <select name="status" value={header.status} onChange={handleHeaderChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Time Logs">
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-600 min-w-[150px]">Project *</th>
                    <th className="px-3 py-2 font-medium text-gray-600 min-w-[150px]">Task</th>
                    <th className="px-3 py-2 font-medium text-gray-600 min-w-[150px]">Activity Type</th>
                    <th className="px-3 py-2 font-medium text-gray-600 w-24">Hours *</th>
                    <th className="px-3 py-2 font-medium text-gray-600 w-20 text-center">Billable</th>
                    <th className="px-3 py-2 font-medium text-gray-600 min-w-[200px]">Description</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {details.map(d => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="p-2">
                        <select value={d.project_id} onChange={(e) => handleDetailChange(d.id, "project_id", e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[12px] bg-white focus:outline-none focus:border-blue-500">
                          <option value="">Select...</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <select value={d.task_id} onChange={(e) => handleDetailChange(d.id, "task_id", e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[12px] bg-white focus:outline-none focus:border-blue-500">
                          <option value="">None</option>
                          {tasks.filter(t => t.project_id === d.project_id).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <select value={d.activity_type_id} onChange={(e) => handleDetailChange(d.id, "activity_type_id", e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[12px] bg-white focus:outline-none focus:border-blue-500">
                          <option value="">None</option>
                          {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="number" value={d.hours} onChange={(e) => handleDetailChange(d.id, "hours", e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-blue-500" placeholder="0.0" />
                      </td>
                      <td className="p-2 text-center pt-3">
                        <input type="checkbox" checked={d.is_billable} onChange={(e) => handleDetailChange(d.id, "is_billable", e.target.checked)}
                          className="rounded border-gray-300 text-blue-600" />
                      </td>
                      <td className="p-2">
                        <input type="text" value={d.description} onChange={(e) => handleDetailChange(d.id, "description", e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-blue-500" placeholder="Work details..." />
                      </td>
                      <td className="p-2 text-right pt-3">
                        <button onClick={() => removeDetailRow(d.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <button onClick={addDetailRow} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
                  <Plus size={14} /> Add Row
                </button>
              </div>
            </div>
          </Section>

          <Section title="Internal Notes">
            <textarea name="note" value={header.note} onChange={handleHeaderChange} rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
              placeholder="Private notes about this timesheet..." />
          </Section>
        </div>
      </div>
    </Workspace>
  );
}

export default function NewTimesheetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading form...</div>}>
      <NewTimesheetForm />
    </Suspense>
  );
}
