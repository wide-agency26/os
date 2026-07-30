"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewTaskTypePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name) { alert("Please enter a name."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("erp_task_types").insert({ name: formData.name, description: formData.description || null });
    if (error) alert("Error: " + error.message);
    else router.push("/app/projects/task-type");
    setLoading(false);
  };

  return (
    <Workspace>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/app/projects/task-type" className="p-2 hover:bg-gray-100 rounded transition-colors"><ArrowLeft size={20} className="text-gray-600" /></Link>
        <h2 className="text-2xl font-bold text-gray-900">New Task Type</h2>
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
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Workspace>
  );
}
