"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash } from "lucide-react";
import Link from "next/link";

export default function EditProjectTypePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [typeId, setTypeId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { id } = await params;
      setTypeId(id);

      const supabase = createClient();
      
      const { data } = await (supabase as any)
        .from("project_types")
        .select("*")
        .eq("id", id)
        .single();
        
      if (data) {
        setFormData({
          name: data.name || "",
          description: data.description || "",
        });
      }
      setLoading(false);
    }
    fetchData();
  }, [params]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert("Please fill in Name.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("project_types")
      .update({
        name: formData.name,
        description: formData.description,
      })
      .eq("id", typeId);
    
    setSaving(false);
    if (error) {
      alert("Error updating project type: " + error.message);
    } else {
      router.push("/app/projects/project-type");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this Project Type?")) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("project_types")
      .delete()
      .eq("id", typeId);
      
    if (error) {
      alert("Error deleting project type: " + error.message);
      setDeleting(false);
    } else {
      router.push("/app/projects/project-type");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/projects/project-type" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Project Type</h2>
              <p className="text-sm text-gray-500 mt-1">Update classification details.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDelete} 
              disabled={deleting}
              className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash size={16} />
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <Section title="Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Description</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange}
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
              />
            </div>
          </Section>
        </div>
      </div>
    </Workspace>
  );
}
