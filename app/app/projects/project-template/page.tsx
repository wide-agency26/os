"use client";

import { useState, useEffect } from "react";
import { Plus, Filter } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ProjectTemplateListView() {
  const [selected, setSelected] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplates() {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("project_templates")
        .select(`
          id, 
          name, 
          description,
          project_type:project_type_id ( name ),
          tasks:project_template_tasks ( count )
        `)
        .order("created_at", { ascending: false });
      
      setTemplates(data || []);
      setLoading(false);
    }
    fetchTemplates();
  }, []);

  const toggleSelectAll = () => {
    if (selected.length === templates.length) setSelected([]);
    else setSelected(templates.map((p) => p.id));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white text-[13px]">
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Project Template</h2>
          <span className="text-gray-500 font-medium">{templates.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app/projects/project-template/new" className="px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={14} /> Add Template
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 border-r border-gray-200 p-4 overflow-y-auto hidden md:block shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Filters</h3>
            <Filter size={14} className="text-gray-400" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200 shadow-sm">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="rounded border-gray-300" checked={selected.length === templates.length && templates.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Template Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Project Type</th>
                <th className="px-4 py-3 font-medium text-gray-500">Tasks Included</th>
                <th className="px-4 py-3 font-medium text-gray-500">Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading templates...</td></tr>
              ) : templates.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No templates found. Create one!</td></tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" checked={selected.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.project_type?.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{t.tasks?.[0]?.count || 0} tasks</td>
                    <td className="px-4 py-3 text-gray-600">{t.description || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
