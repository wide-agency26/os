"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    client_id: "",
    status: "running",
    priority: "Medium",
    department: "",
    expected_start_date: "",
    expected_end_date: "",
    estimated_cost: "",
    scope: "",
    template_id: "",
    project_type_id: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const { data: clientsData } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, company_name")
        .eq("role", "client")
        .order("full_name", { ascending: true });
      setClients(clientsData || []);

      const { data: templatesData } = await (supabase as any)
        .from("project_templates")
        .select("id, name");
      setTemplates(templatesData || []);

      const { data: pTypesData } = await (supabase as any)
        .from("project_types")
        .select("id, name")
        .order("name", { ascending: true });
      setProjectTypes(pTypesData || []);
    }
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.client_id) {
      alert("Please fill in Title and Customer.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: project, error } = await (supabase as any)
      .from("projects")
      .insert([{
        title: formData.title,
        client_id: formData.client_id,
        project_type_id: formData.project_type_id || null,
        status: formData.status,
        priority: formData.priority,
        department: formData.department,
        expected_start_date: formData.expected_start_date || null,
        expected_end_date: formData.expected_end_date || null,
        estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
        scope: formData.scope
      }])
      .select("id")
      .single();
    
    if (error) {
      setLoading(false);
      alert("Error creating project: " + error.message);
      return;
    }

    // Auto-generate Tasks if a Template is selected
    if (formData.template_id) {
      const { data: templateTasks } = await (supabase as any)
        .from("project_template_tasks")
        .select("*")
        .eq("template_id", formData.template_id);
      
      if (templateTasks && templateTasks.length > 0) {
        const tasksToInsert = templateTasks.map((tt: any) => ({
          project_id: project.id,
          title: tt.title,
          description: tt.description,
          priority: tt.priority,
          weight: tt.weight,
          expected_time: tt.expected_time,
          status: "Open",
          progress: 0
        }));

        await (supabase as any).from("erp_tasks").insert(tasksToInsert);
      }
    }

    setLoading(false);
    router.push(`/app/projects/${project.id}`);
  };

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/projects" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">New Project</h2>
              <p className="text-sm text-gray-500 mt-1">Create a new project workspace.</p>
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
                      {c.full_name} {c.company_name ? `(${c.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
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
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Create from Template (Optional)</label>
                  <select 
                    name="template_id" 
                    value={formData.template_id} 
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">No template (Start from scratch)</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">If selected, tasks from the template will be automatically generated for this project.</p>
                </div>
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
