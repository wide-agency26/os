"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

import { Suspense } from "react";

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("project") || "";

  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    title: "",
    project_id: initialProjectId,
    assigned_to: "",
    status: "Open",
    priority: "Medium",
    weight: "0",
    progress: "0",
    expected_start_date: "",
    expected_end_date: "",
    expected_time: "",
    description: "",
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      // Fetch projects for dropdown
      const { data: projData } = await supabase
        .from("projects")
        .select("id, title")
        .eq("status", "running");
      if (projData) setProjects(projData);

      // Fetch team members/profiles for assignee
      const { data: userData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["admin", "superadmin", "client_manager", "bd_manager"]); // internal team roles
      if (userData) setUsers(userData);
    }
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.project_id) {
      alert("Please fill in Title and Project.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("erp_tasks")
      .insert([{
        title: formData.title,
        project_id: formData.project_id,
        assigned_to: formData.assigned_to || null,
        status: formData.status,
        priority: formData.priority,
        weight: formData.weight ? Number(formData.weight) : 0,
        progress: formData.progress ? Number(formData.progress) : 0,
        expected_start_date: formData.expected_start_date || null,
        expected_end_date: formData.expected_end_date || null,
        expected_time: formData.expected_time ? Number(formData.expected_time) : 0,
        description: formData.description
      }])
      .select("id")
      .single();
    
    setLoading(false);

    if (error) {
      alert("Error creating task: " + error.message);
    } else {
      router.push(`/app/projects/${formData.project_id}`);
    }
  };

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">New Task</h2>
              <p className="text-sm text-gray-500 mt-1">Create a new task and assign it to a project.</p>
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="space-y-6">
          <Section title="Task Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="Task subject..."
                />
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
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Assignee</label>
                <select 
                  name="assigned_to" 
                  value={formData.assigned_to} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Done">Done</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Priority</label>
                  <select 
                    name="priority" 
                    value={formData.priority} 
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Timeline & Progress">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Expected Start</label>
                <input 
                  type="date" 
                  name="expected_start_date" 
                  value={formData.expected_start_date} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Expected End (Due)</label>
                <input 
                  type="date" 
                  name="expected_end_date" 
                  value={formData.expected_end_date} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Estimated Hours</label>
                <input 
                  type="number" 
                  name="expected_time" 
                  value={formData.expected_time} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Weight (0-100)</label>
                <input 
                  type="number" 
                  name="weight" 
                  value={formData.weight} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="0"
                />
              </div>
            </div>
          </Section>

          <Section title="Description">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Task Description</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange}
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                placeholder="Detailed instructions or specifications..."
              />
            </div>
          </Section>
        </div>
      </div>
    </Workspace>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading form...</div>}>
      <NewTaskForm />
    </Suspense>
  );
}
