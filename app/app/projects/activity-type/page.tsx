"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { Plus, MoreHorizontal, Search, Trash } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ActivityTypeListView() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("activity_types")
      .select("id, name, default_costing_rate, default_billing_rate, created_at")
      .order("name", { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} activity type(s)?`)) return;
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("activity_types").delete().in("id", Array.from(selectedIds));
    if (error) alert("Error: " + error.message);
    else { setSelectedIds(new Set()); await fetchItems(); }
    setIsDeleting(false);
  };

  const formatCurrency = (v: number) => `$${Number(v || 0).toFixed(2)}`;

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Activity Types</h2>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} disabled={isDeleting}
              className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-100 transition-colors flex items-center gap-2">
              <Trash size={16} />
              {isDeleting ? "Deleting..." : `Delete ${selectedIds.size}`}
            </button>
          )}
          <Link href="/app/projects/activity-type/new"
            className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus size={16} /> New Activity Type
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 font-medium text-gray-600">Default Costing Rate</th>
              <th className="px-4 py-3 font-medium text-gray-600">Default Billing Rate</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No activity types found.</td></tr>
            ) : items.map((item, idx) => (
              <tr key={item.id || idx} onClick={() => router.push(`/app/projects/activity-type/${item.id}`)}
                className="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer">
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(item.id)}
                    onChange={e => toggleSelect(item.id, e as any)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ opacity: selectedIds.has(item.id) ? 1 : undefined }} />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                <td className="px-4 py-3 text-gray-600">{formatCurrency(item.default_costing_rate)}</td>
                <td className="px-4 py-3 text-gray-600">{formatCurrency(item.default_billing_rate)}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Workspace>
  );
}
