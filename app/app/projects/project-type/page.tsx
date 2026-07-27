"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProjectTypeListView() {
  const router = useRouter();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTypes();
  }, []);

  async function fetchTypes() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("project_types")
      .select("*")
      .order("name", { ascending: true });
    
    setTypes(data || []);
    setSelectedIds(new Set());
    setLoading(false);
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(types.map(t => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation(); // prevent row click
    const newSet = new Set(selectedIds);
    if (e.target.checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleRowClick = (id: string) => {
    router.push(`/app/projects/project-type/${id}`);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} project types?`)) return;

    setIsDeleting(true);
    const supabase = createClient();
    const idsToDelete = Array.from(selectedIds);

    const { error } = await (supabase as any)
      .from("project_types")
      .delete()
      .in('id', idsToDelete);

    if (error) {
      alert("Error deleting project types: " + error.message);
    } else {
      await fetchTypes();
    }
    setIsDeleting(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading project types...</div>;

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Project Types</h2>
          <p className="text-sm text-gray-500 mt-1">Classification of projects into different types.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-100 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              {isDeleting ? "Deleting..." : `Delete ${selectedIds.size} Selected`}
            </button>
          )}
          <Link 
            href="/app/projects/project-type/new" 
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            New Project Type
          </Link>
        </div>
      </div>

      <Section title="Project Types List">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {types.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Plus className="text-gray-400" size={24} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Project Types found</h3>
              <p className="text-gray-500 text-sm mb-4">Get started by creating your first project type.</p>
              <Link 
                href="/app/projects/project-type/new" 
                className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors"
              >
                Create Project Type
              </Link>
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={selectedIds.size === types.length && types.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr 
                    key={type.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer"
                    onClick={() => handleRowClick(type.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className={`rounded border-gray-300 transition-opacity ${selectedIds.has(type.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        checked={selectedIds.has(type.id)}
                        onChange={(e) => handleSelectOne(e, type.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {type.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-md">
                      {type.description || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </Workspace>
  );
}
