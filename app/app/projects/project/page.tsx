"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { Plus, MoreHorizontal, Filter, Search, Trash, FileUp } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ProjectListView() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("projects")
      .select(`
        id, 
        title, 
        status, 
        priority, 
        expected_start_date,
        expected_end_date,
        client:client_id ( company, name ),
        project_type:project_type_id ( name )
      `)
      .order("created_at", { ascending: false });
    
    setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} project(s)?`)) return;
    setIsDeleting(true);
    const supabase = createClient();
    
    const idsToDelete = Array.from(selectedIds);
    
    const { error } = await (supabase as any)
      .from("projects")
      .delete()
      .in('id', idsToDelete);
      
    if (error) {
      alert("Error deleting projects: " + error.message);
    } else {
      setSelectedIds(new Set());
      await fetchProjects();
    }
    setIsDeleting(false);
  };

  const handleRowClick = (id: string) => {
    router.push(`/app/projects/${id}`);
  };

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
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
          <Link href="/app/projects/project/bulk-import" className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            <FileUp size={16} />
            Bulk Import
          </Link>
          <button className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <div className="h-4 w-px bg-gray-300 mx-1"></div>
          <Link href="/app/projects/project/new" className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus size={16} />
            New Project
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="text-[13px] text-gray-500">
            {projects.length} projects
          </div>
        </div>

        <table className="w-full text-left text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox" 
                  checked={projects.length > 0 && selectedIds.size === projects.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                />
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Project Name</th>
              <th className="px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Priority</th>
              <th className="px-4 py-3 font-medium text-gray-600">Start Date</th>
              <th className="px-4 py-3 font-medium text-gray-600">End Date</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : projects.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No projects found.</td></tr>
            ) : (
              projects.map((p, idx) => (
                <tr 
                  key={p.id || idx} 
                  onClick={() => handleRowClick(p.id)}
                  className="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => toggleSelect(p.id, e as any)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                      style={{ opacity: selectedIds.has(p.id) ? 1 : undefined }}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                  <td className="px-4 py-3 text-gray-600">{p.project_type?.name || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.client?.company || p.client?.name || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      p.status === 'completed' ? 'bg-green-100 text-green-700' :
                      p.status === 'expired' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {p.status || "running"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.priority || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.expected_start_date || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.expected_end_date || "-"}</td>
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
