"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewProjectUpdatePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    project_id: "",
    update_date: new Date().toISOString().slice(0, 10),
    status: "On Track",
    progress_snapshot: "",
    summary: "",
    challenges: "",
    next_steps: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data } = await supabase.from("projects").select("id, title").eq("status", "running").order("title");
      setProjects(data || []);
    }
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.project_id) { alert("Please select a project."); return; }
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("erp_project_updates").insert({
      project_id: formData.project_id,
      update_date: formData.update_date,
      status: formData.status,
      progress_snapshot: parseFloat(formData.progress_snapshot) || 0,
      summary: formData.summary || null,
      challenges: formData.challenges || null,
      next_steps: formData.next_steps || null,
      created_by: user?.id || null,
    });
    if (error) alert("Error: " + error.message);
    else router.push("/app/projects/project-update");
    setLoading(false);
  };

  return (
    <Workspace>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/app/projects/project-update" className="p-2 hover:bg-gray-100 rounded transition-colors"><ArrowLeft size={20} className="text-gray-600" /></Link>
        <h2 className="text-2xl font-bold text-gray-900">New Project Update</h2>
      </div>
      <div className="max-w-2xl">
        <Section title="Update Details">
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Project <span className="text-red-500">*</span></label>
                <select name="project_id" value={formData.project_id} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Date</label>
                <input type="date" name="update_date" value={formData.update_date} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Status</label>
                <select name="status" value={formData.status} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="On Track">On Track</option>
                  <option value="At Risk">At Risk</option>
                  <option value="Behind Schedule">Behind Schedule</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Progress %</label>
                <input type="number" min="0" max="100" name="progress_snapshot" value={formData.progress_snapshot} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Summary</label>
              <textarea name="summary" value={formData.summary} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="What was accomplished this period?" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Challenges</label>
              <textarea name="challenges" value={formData.challenges} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Any blockers or risks?" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Next Steps</label>
              <textarea name="next_steps" value={formData.next_steps} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="What's planned for the next period?" />
            </div>
          </div>
        </Section>
        <div className="flex justify-end gap-3 mt-6">
          <Link href="/app/projects/project-update" className="px-4 py-2 bg-white border border-gray-300 rounded text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Workspace>
  );
}
