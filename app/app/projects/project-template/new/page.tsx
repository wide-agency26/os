"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

interface TemplateTask {
  id: string; // temp id for UI
  title: string;
  description: string;
  expected_time: string;
}

export default function NewProjectTemplatePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    project_type_id: "",
  });
  
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProjectTypes() {
      const supabase = createClient();
      const { data } = await (supabase as any).from("project_types").select("id, name");
      if (data) setProjectTypes(data);
    }
    fetchProjectTypes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addTaskRow = () => {
    setTasks([...tasks, { id: Date.now().toString(), title: "", description: "", expected_time: "" }]);
  };

  const removeTaskRow = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleTaskChange = (id: string, field: keyof TemplateTask, value: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert("Please provide a Template Name.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 1. Insert Template
    const { data: templateData, error: templateError } = await (supabase as any)
      .from("project_templates")
      .insert([{
        name: formData.name,
        description: formData.description,
        project_type_id: formData.project_type_id || null,
      }])
      .select("id")
      .single();

    if (templateError) {
      alert("Error creating template: " + templateError.message);
      setLoading(false);
      return;
    }

    // 2. Insert Tasks
    if (tasks.length > 0) {
      const tasksToInsert = tasks.filter(t => t.title.trim() !== "").map(t => ({
        template_id: templateData.id,
        title: t.title,
        description: t.description,
        expected_time: t.expected_time ? Number(t.expected_time) : 0,
      }));

      if (tasksToInsert.length > 0) {
        const { error: tasksError } = await (supabase as any)
          .from("project_template_tasks")
          .insert(tasksToInsert);
        
        if (tasksError) {
          console.error("Error creating template tasks:", tasksError);
        }
      }
    }
    
    setLoading(false);
    router.push(`/app/projects/project-template`);
  };

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/projects/project-template" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">New Project Template</h2>
              <p className="text-sm text-gray-500 mt-1">Define standard tasks for a reusable project structure.</p>
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? "Saving..." : "Save Template"}
          </button>
        </div>

        <div className="space-y-6">
          <Section title="Template Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Template Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="e.g. Standard Web Development"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Project Type</label>
                <select 
                  name="project_type_id" 
                  value={formData.project_type_id} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a project type...</option>
                  {projectTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="What is this template used for?"
                />
              </div>
            </div>
          </Section>

          <Section title="Default Tasks">
            <div className="col-span-full border border-gray-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-600">Task Title <span className="text-red-500">*</span></th>
                    <th className="px-4 py-2 font-medium text-gray-600">Description</th>
                    <th className="px-4 py-2 font-medium text-gray-600 w-32">Est. Hours</th>
                    <th className="px-4 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="p-2">
                        <input 
                          type="text" 
                          value={task.title}
                          onChange={(e) => handleTaskChange(task.id, 'title', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500"
                          placeholder="Task title"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text" 
                          value={task.description}
                          onChange={(e) => handleTaskChange(task.id, 'description', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500"
                          placeholder="Brief description"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          value={task.expected_time}
                          onChange={(e) => handleTaskChange(task.id, 'expected_time', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500"
                          placeholder="0.0"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeTaskRow(task.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="p-3 bg-gray-50/50">
                      <button 
                        onClick={addTaskRow}
                        className="text-[13px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Task
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </Workspace>
  );
}
