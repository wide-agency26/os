"use client";

import { useState, useEffect } from "react";
import { Plus, Filter, FileUp } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ProjectListView() {
  const [selected, setSelected] = useState<string[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
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
          client:client_id ( company, name )
        `)
        .order("created_at", { ascending: false });
      
      setProjects(data || []);
      setLoading(false);
    }
    fetchProjects();
  }, []);

  const toggleSelectAll = () => {
    if (selected.length === projects.length) setSelected([]);
    else setSelected(projects.map((p) => p.id));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white text-[13px]">
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Project</h2>
          <span className="text-gray-500 font-medium">{projects.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app/projects/project/bulk-import" className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors flex items-center gap-1.5">
            <FileUp size={14} /> Import as Bulk
          </Link>
          <Link href="/app/projects/project/new" className="px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={14} /> Add Project
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
                  <input type="checkbox" className="rounded border-gray-300" checked={selected.length === projects.length && projects.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Project Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 font-medium text-gray-500">Priority</th>
                <th className="px-4 py-3 font-medium text-gray-500">Start Date</th>
                <th className="px-4 py-3 font-medium text-gray-500">End Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading projects...</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">No projects found.</td></tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/app/projects/${p.id}`} className="font-medium text-gray-900 hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'expired' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.client?.company || p.client?.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.priority || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.expected_start_date || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.expected_end_date || '-'}</td>
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
