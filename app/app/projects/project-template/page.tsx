"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { Plus, MoreHorizontal, Filter, Search, Trash } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ProjectTemplateListView() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("project_templates")
      .select(`
        id, 
        name, 
        description,
        project_type:project_types ( name ),
        tasks:project_template_tasks ( count )
      `)
      .order("created_at", { ascending: false });
    
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent row click
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} template(s)?`)) return;
    setIsDeleting(true);
    const supabase = createClient();
    
    // Convert Set to Array
    const idsToDelete = Array.from(selectedIds);
    
    // Let Cascade delete handle the project_template_tasks, just delete templates
    const { error } = await (supabase as any)
      .from("project_templates")
      .delete()
      .in('id', idsToDelete);
      
    if (error) {
      alert("Error deleting templates: " + error.message);
    } else {
      setSelectedIds(new Set());
      await fetchTemplates();
    }
    setIsDeleting(false);
  };

  const handleRowClick = (id: string) => {
    router.push(`/app/projects/project-template/${id}`);
  };

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Project Templates</h2>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-100 transition-colors flex items-center gap-2"
            >
              <Trash size={16} />
              {isDeleting ? "Deleting..." : `Delete ${selectedIds.size}`}
            </button>
          )}
          <button className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <div className="h-4 w-px bg-gray-300 mx-1"></div>
          <Link href="/app/projects/project-template/new" className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus size={16} />
            New Template
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search templates..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="text-[13px] text-gray-500">
            {templates.length} templates
          </div>
        </div>

        <table className="w-full text-left text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox" 
                  checked={templates.length > 0 && selectedIds.size === templates.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                />
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Template Name</th>
              <th className="px-4 py-3 font-medium text-gray-600">Project Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Tasks Included</th>
              <th className="px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No templates found.</td></tr>
            ) : (
              templates.map((template, idx) => (
                <tr 
                  key={template.id || idx} 
                  onClick={() => handleRowClick(template.id)}
                  className="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(template.id)}
                      onChange={(e) => toggleSelect(template.id, e as any)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                      style={{ opacity: selectedIds.has(template.id) ? 1 : undefined }}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{template.name}</td>
                  <td className="px-4 py-3 text-gray-600">{template.project_type?.name || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{template.tasks?.[0]?.count || 0} tasks</td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{template.description || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Workspace>
  );
}
