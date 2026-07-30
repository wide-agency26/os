"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash } from "lucide-react";
import Link from "next/link";

export default function EditTaskTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data } = await (supabase as any).from("erp_task_types").select("*").eq("id", id).single();
      if (data) setFormData({ name: data.name || "", description: data.description || "" });
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name) { alert("Please enter a name."); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("erp_task_types").update({ name: formData.name, description: formData.description || null }).eq("id", id);
    if (error) alert("Error: " + error.message);
    else router.push("/app/projects/task-type");
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task type?")) return;
    const supabase = createClient();
    await (supabase as any).from("erp_task_types").delete().eq("id", id);
    router.push("/app/projects/task-type");
  };

  if (loading) return <Workspace><div className="animate-pulse h-40 bg-gray-100 rounded" /></Workspace>;

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/app/projects/task-type" className="p-2 hover:bg-gray-100 rounded transition-colors"><ArrowLeft size={20} className="text-gray-600" /></Link>
          <h2 className="text-2xl font-bold text-gray-900">Edit Task Type</h2>
        </div>
        <button onClick={handleDelete} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-100 transition-colors flex items-center gap-2">
          <Trash size={16} /> Delete
        </button>
      </div>
      <div className="max-w-2xl">
        <Section title="Task Type Details">
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </Section>
        <div className="flex justify-end gap-3 mt-6">
          <Link href="/app/projects/task-type" className="px-4 py-2 bg-white border border-gray-300 rounded text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Workspace>
  );
}
