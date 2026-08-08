"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash } from "lucide-react";
import Link from "next/link";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [clients, setClients] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    client_id: "",
    project_type_id: "",
    status: "running",
    stage: "signed",
    priority: "Medium",
    department: "",
    expected_start_date: "",
    expected_end_date: "",
    estimated_cost: "",
    deal_value: "",
    scope: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { id } = await params;
      setProjectId(id);

      const supabase = createClient();
      
      const { data: clientsData } = await (supabase as any)
        .from("crm_customers")
        .select("id, name, company")
        .order("name", { ascending: true });
      setClients(clientsData || []);

      const { data: pTypesData } = await (supabase as any)
        .from("project_types")
        .select("id, name")
        .order("name", { ascending: true });
      setProjectTypes(pTypesData || []);

      const { data: project } = await (supabase as any)
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
        
      if (project) {
        setFormData({
          title: project.title || "",
          client_id: project.client_id || "",
          project_type_id: project.project_type_id || "",
          status: project.status || "running",
          stage: project.stage || "signed",
          priority: project.priority || "Medium",
          department: project.department || "",
          expected_start_date: project.expected_start_date || "",
          expected_end_date: project.expected_end_date || "",
          estimated_cost: project.estimated_cost?.toString() || "",
          deal_value:
            project.deal_value != null ? String(project.deal_value) : "",
          scope: project.scope || "",
        });
      }
      setLoading(false);
    }
    fetchData();
  }, [params]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.client_id) {
      alert("Please fill in Title and Customer.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("projects")
      .update({
        title: formData.title,
        client_id: formData.client_id,
        project_type_id: formData.project_type_id || null,
        status: formData.status,
        stage: formData.stage || "prospect",
        priority: formData.priority,
        department: formData.department,
        expected_start_date: formData.expected_start_date || null,
        expected_end_date: formData.expected_end_date || null,
        estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
        deal_value: formData.deal_value ? Number(formData.deal_value) : null,
        scope: formData.scope
      })
      .eq("id", projectId);
    
    setSaving(false);
    if (error) {
      alert("Error updating project: " + error.message);
    } else {
      try {
        const { runSyncProjectLedger } = await import("@/app/actions/accounting");
        await runSyncProjectLedger(projectId);
      } catch (e) {
        console.error("ledger sync failed", e);
      }
      router.push(`/app/projects/${projectId}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("projects")
      .delete()
      .eq("id", projectId);
      
    if (error) {
      alert("Error deleting project: " + error.message);
      setDeleting(false);
    } else {
      router.push("/app/projects/project");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading project...</div>;
  }

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href={`/app/projects/${projectId}`} className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Project</h2>
              <p className="text-sm text-gray-500 mt-1">Update project details.</p>
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

        {/* Form Sections */}
        <div className="space-y-6">
          <Section title="Basic Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="e.g. Website Redesign"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-medium text-gray-700">Customer <span className="text-red-500">*</span></label>
                  <Link href="/app/crm/new" className="text-[11px] text-blue-600 hover:underline">
                    + New Customer
                  </Link>
                </div>
                <select 
                  name="client_id" 
                  value={formData.client_id} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a customer...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Project Type</label>
                <select 
                  name="project_type_id" 
                  value={formData.project_type_id} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a Project Type...</option>
                  {projectTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
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
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Accounting stage
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="prospect">Prospect (Identified P&amp;L)</option>
                  <option value="signed">Signed (Actual P&amp;L)</option>
                  <option value="completed">Completed (Actual P&amp;L)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Prospect → signed migrates identified ledger rows to actual automatically.
                </p>
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
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Department</label>
                <input 
                  type="text" 
                  name="department" 
                  value={formData.department} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="e.g. IT, Marketing"
                />
              </div>
            </div>
          </Section>

          <Section title="Timeline & Costing">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Expected Start Date</label>
                <input 
                  type="date" 
                  name="expected_start_date" 
                  value={formData.expected_start_date} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Expected End Date</label>
                <input 
                  type="date" 
                  name="expected_end_date" 
                  value={formData.expected_end_date} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Estimated Cost</label>
                <input 
                  type="number" 
                  name="estimated_cost" 
                  value={formData.estimated_cost} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Deal value (revenue)
                </label>
                <input
                  type="number"
                  name="deal_value"
                  value={formData.deal_value}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Feeds auto revenue on Actual / Identified P&amp;L.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Additional Information">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Scope / Description</label>
              <textarea 
                name="scope" 
                value={formData.scope} 
                onChange={handleChange}
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                placeholder="Detailed description of the project scope..."
              />
            </div>
          </Section>
        </div>
      </div>
    </Workspace>
  );
}
