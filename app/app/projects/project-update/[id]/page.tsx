"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash } from "lucide-react";
import Link from "next/link";

export default function EditProjectUpdatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    project_id: "", update_date: "", status: "On Track",
    progress_snapshot: "", summary: "", challenges: "", next_steps: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: item }, { data: projData }] = await Promise.all([
        (supabase as any).from("erp_project_updates").select("*").eq("id", id).single(),
        supabase.from("projects").select("id, title").order("title"),
      ]);
      if (item) setFormData({
        project_id: item.project_id || "",
        update_date: item.update_date || "",
        status: item.status || "On Track",
        progress_snapshot: String(item.progress_snapshot || ""),
        summary: item.summary || "",
        challenges: item.challenges || "",
        next_steps: item.next_steps || "",
      });
      setProjects(projData || []);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("erp_project_updates").update({
      project_id: formData.project_id,
      update_date: formData.update_date,
      status: formData.status,
      progress_snapshot: parseFloat(formData.progress_snapshot) || 0,
      summary: formData.summary || null,
      challenges: formData.challenges || null,
      next_steps: formData.next_steps || null,
    }).eq("id", id);
    if (error) alert("Error: " + error.message);
    else router.push("/app/projects/project-update");
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project update?")) return;
    const supabase = createClient();
    await (supabase as any).from("erp_project_updates").delete().eq("id", id);
    router.push("/app/projects/project-update");
  };

  if (loading) return <Workspace><div className="animate-pulse h-40 bg-gray-100 rounded" /></Workspace>;

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/app/projects/project-update" className="p-2 hover:bg-gray-100 rounded transition-colors"><ArrowLeft size={20} className="text-gray-600" /></Link>
          <h2 className="text-2xl font-bold text-gray-900">Edit Project Update</h2>
        </div>
        <button onClick={handleDelete} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-100 transition-colors flex items-center gap-2">
          <Trash size={16} /> Delete
        </button>
      </div>
      <div className="max-w-2xl">
        <Section title="Update Details">
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Project</label>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Summary</label>
              <textarea name="summary" value={formData.summary} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Challenges</label>
              <textarea name="challenges" value={formData.challenges} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Next Steps</label>
              <textarea name="next_steps" value={formData.next_steps} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </Section>
        <div className="flex justify-end gap-3 mt-6">
          <Link href="/app/projects/project-update" className="px-4 py-2 bg-white border border-gray-300 rounded text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Workspace>
  );
}
