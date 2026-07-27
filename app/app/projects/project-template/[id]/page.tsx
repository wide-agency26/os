"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash, Plus, GripVertical } from "lucide-react";
import Link from "next/link";

interface TemplateTask {
  id: string; // temp id for UI only
  subject: string;
  description: string;
  task_weight: number;
}

export default function EditProjectTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    name: "",
    project_type_id: "",
    description: "",
  });
  
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const { data: pTypes } = await (supabase as any).from("project_types").select("id, name");
      if (pTypes) setProjectTypes(pTypes);

      const { data: template, error: templateError } = await (supabase as any)
        .from("project_templates")
        .select("*")
        .eq("id", id)
        .single();
        
      if (template) {
        setFormData({
          name: template.name || "",
          project_type_id: template.project_type_id || "",
          description: template.description || "",
        });

        const { data: templateTasks } = await (supabase as any)
          .from("project_template_tasks")
          .select("*")
          .eq("template_id", id)
          .order("created_at", { ascending: true });
          
        if (templateTasks) {
          setTasks(templateTasks.map((t: any) => ({
            id: t.id,
            subject: t.title || t.subject, // fallback for legacy data
            description: t.description,
            task_weight: t.expected_time || t.task_weight || 1
          })));
        }
      }
      setFetching(false);
    }
    if (id) fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addTask = () => {
    setTasks([...tasks, { id: crypto.randomUUID(), subject: "", description: "", task_weight: 1 }]);
  };

  const removeTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const updateTask = (taskId: string, field: keyof TemplateTask, value: any) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert("Please provide a Template Name.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Update template
    const { error: templateError } = await (supabase as any)
      .from("project_templates")
      .update({
        name: formData.name,
        project_type_id: formData.project_type_id || null,
        description: formData.description,
      })
      .eq("id", id);
    
    if (templateError) {
      alert("Error updating template: " + templateError.message);
      setLoading(false);
      return;
    }

    // Replace tasks: delete old, insert new
    await (supabase as any).from("project_template_tasks").delete().eq("template_id", id);

    if (tasks.length > 0) {
      const taskInserts = tasks.filter(t => t.subject.trim() !== "").map(t => ({
        template_id: id,
        title: t.subject,
        description: t.description,
        expected_time: t.task_weight
      }));

      if (taskInserts.length > 0) {
        const { error: tasksError } = await (supabase as any)
          .from("project_template_tasks")
          .insert(taskInserts);
          
        if (tasksError) {
          alert("Template updated but error saving tasks: " + tasksError.message);
        }
      }
    }

    setLoading(false);
    router.push(`/app/projects/project-template`);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this template? This cannot be undone.")) return;
    
    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("project_templates")
      .delete()
      .eq("id", id);
    
    setLoading(false);
    if (error) {
      alert("Error deleting record: " + error.message);
    } else {
      router.push(`/app/projects/project-template`);
    }
  };

  if (fetching) {
    return <Workspace><div className="p-8 text-center text-gray-500">Loading template...</div></Workspace>;
  }

  return (
    <Workspace>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/projects/project-template" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Project Template</h2>
              <p className="text-sm text-gray-500 mt-1">{formData.name}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Section title="Template Details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Template Name <span className="text-red-500">*</span></label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. Full Digital Marketing" />
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
                <div className="col-span-full">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="What is this template for?"></textarea>
                </div>
              </div>
            </Section>

            <Section title="Default Tasks">
              <div className="space-y-4">
                <p className="text-[13px] text-gray-500">Add standard tasks that should automatically be created when a project uses this template.</p>
                
                {tasks.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 w-8"></th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-[12px]">Task Title <span className="text-red-500">*</span></th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-[12px] w-24">Est. Hours</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task, index) => (
                          <tr key={task.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 group">
                            <td className="px-3 py-2 text-gray-400 cursor-move">
                              <GripVertical size={14} />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={task.subject}
                                onChange={(e) => updateTask(task.id, 'subject', e.target.value)}
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 px-1 py-1 text-[13px]"
                                placeholder="Task subject"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="number" 
                                value={task.task_weight}
                                onChange={(e) => updateTask(task.id, 'task_weight', Number(e.target.value))}
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 px-1 py-1 text-[13px]"
                                min="0"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => removeTask(task.id)} className="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-1">
                                <Trash size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button 
                  onClick={addTask}
                  className="px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded text-[12px] font-medium transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Task row
                </button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </Workspace>
  );
}
