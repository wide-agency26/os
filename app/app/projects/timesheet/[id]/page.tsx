"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash } from "lucide-react";
import Link from "next/link";

export default function EditTimesheetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    person_id: "",
    project_id: "",
    activity_type_id: "",
    log_date: new Date().toISOString().split("T")[0],
    hours: "",
    is_billable: true,
    billing_rate: "",
    notes: "",
    status: "Draft",
  });
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const { data: projData } = await supabase.from("projects").select("id, title").eq("status", "running");
      if (projData) setProjects(projData);

      const { data: userData } = await supabase.from("profiles").select("id, full_name").in("role", ["admin", "superadmin", "client_manager", "bd_manager"]);
      if (userData) setUsers(userData);

      const { data: activityData } = await (supabase as any).from("activity_types").select("id, name, default_billing_rate");
      if (activityData) setActivities(activityData);

      const { data: timesheetData } = await (supabase as any)
        .from("erp_timesheets")
        .select("*")
        .eq("id", id)
        .single();
        
      if (timesheetData) {
        setFormData({
          person_id: timesheetData.person_id || "",
          project_id: timesheetData.project_id || "",
          activity_type_id: timesheetData.activity_type_id || "",
          log_date: timesheetData.log_date || new Date().toISOString().split("T")[0],
          hours: timesheetData.hours?.toString() || "",
          is_billable: timesheetData.is_billable ?? true,
          billing_rate: timesheetData.billing_rate?.toString() || "",
          notes: timesheetData.notes || "",
          status: timesheetData.status || "Draft",
        });
      }
      setFetching(false);
    }
    if (id) fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleActivityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const activityId = e.target.value;
    const selectedActivity = activities.find(a => a.id === activityId);
    setFormData({ 
      ...formData, 
      activity_type_id: activityId,
      billing_rate: selectedActivity ? selectedActivity.default_billing_rate : formData.billing_rate
    });
  };

  const handleSave = async () => {
    if (!formData.person_id || !formData.project_id || !formData.hours) {
      alert("Please fill in Person, Project, and Hours.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("erp_timesheets")
      .update({
        person_id: formData.person_id,
        project_id: formData.project_id,
        activity_type_id: formData.activity_type_id || null,
        log_date: formData.log_date,
        hours: Number(formData.hours),
        is_billable: formData.is_billable,
        billing_rate: formData.billing_rate ? Number(formData.billing_rate) : 0,
        notes: formData.notes,
        status: formData.status
      })
      .eq("id", id);
    
    setLoading(false);

    if (error) {
      alert("Error logging time: " + error.message);
    } else {
      router.push(`/app/projects/timesheet`);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this timesheet entry? This cannot be undone.")) return;
    
    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("erp_timesheets")
      .delete()
      .eq("id", id);
    
    setLoading(false);
    if (error) {
      alert("Error deleting record: " + error.message);
    } else {
      router.push(`/app/projects/timesheet`);
    }
  };

  if (fetching) {
    return <Workspace><div className="p-8 text-center text-gray-500">Loading form...</div></Workspace>;
  }

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/projects/timesheet" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Timesheet</h2>
              <p className="text-sm text-gray-500 mt-1">Record hours worked on a project.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash size={16} />
              Delete
            </button>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <Section title="Timesheet Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Employee / User <span className="text-red-500">*</span></label>
                <select 
                  name="person_id" 
                  value={formData.person_id} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select person...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Project <span className="text-red-500">*</span></label>
                <select 
                  name="project_id" 
                  value={formData.project_id} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Activity Type</label>
                <select 
                  name="activity_type_id" 
                  value={formData.activity_type_id} 
                  onChange={handleActivityChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select activity...</option>
                  {activities.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Status</label>
                <select 
                  name="status" 
                  value={formData.status} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Time & Billing">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="col-span-1">
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Date</label>
                <input 
                  type="date" 
                  name="log_date" 
                  value={formData.log_date} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                />
              </div>
              <div className="col-span-1">
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Hours <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  name="hours" 
                  value={formData.hours} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="0.0"
                  step="0.5"
                />
              </div>
              <div className="col-span-1 flex items-center pt-5">
                <label className="flex items-center gap-2 text-[13px] font-medium text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="is_billable" 
                    checked={formData.is_billable} 
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                  />
                  Is Billable?
                </label>
              </div>
              <div className="col-span-1">
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Billing Rate</label>
                <input 
                  type="number" 
                  name="billing_rate" 
                  value={formData.billing_rate} 
                  onChange={handleChange}
                  disabled={!formData.is_billable}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100" 
                  placeholder="0.00"
                />
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Work Description</label>
              <textarea 
                name="notes" 
                value={formData.notes} 
                onChange={handleChange}
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                placeholder="What did you work on?"
              />
            </div>
          </Section>
        </div>
      </div>
    </Workspace>
  );
}
