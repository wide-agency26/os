"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { Plus, Filter, Trash, Edit2, Search, FileUp } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function CRMListView() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string[]>([]);

  const fetchCustomers = async () => {
    setLoading(true);
    const supabase = createClient();
    
    let query = (supabase as any)
      .from("crm_customers")
      .select(`
        id, 
        name, 
        company, 
        status, 
        lead_status,
        role,
        email,
        contract_value
      `)
      .order("created_at", { ascending: false });

    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }
    if (leadStatusFilter.length > 0) {
      query = query.in("lead_status", leadStatusFilter);
    }
    
    const { data } = await query;
    setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter, leadStatusFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map(c => c.id)));
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
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} record(s)?`)) return;

    setIsDeleting(true);
    const supabase = createClient();
    const idsToDelete = Array.from(selectedIds);

    const { error } = await (supabase as any)
      .from("crm_customers")
      .delete()
      .in("id", idsToDelete);
    
    if (error) {
      alert("Error deleting: " + error.message);
    } else {
      setSelectedIds(new Set());
      await fetchCustomers();
    }
    setIsDeleting(false);
  };

  const toggleFilter = (type: "status" | "lead_status", value: string) => {
    if (type === "status") {
      setStatusFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else {
      setLeadStatusFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    }
  };

  const handleRowClick = (id: string) => {
    router.push(`/app/crm/${id}`);
  };

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">CRM Directory</h2>
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
          <Link href="/app/crm/bulk-import" className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            <FileUp size={16} />
            Bulk Import
          </Link>
          <button className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <div className="h-4 w-px bg-gray-300 mx-1"></div>
          <Link href="/app/crm/new" className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus size={16} />
            Add Lead / Client
          </Link>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Working Filters Sidebar */}
        <div className="w-56 overflow-y-auto hidden md:block shrink-0">
          <div className="bg-gray-50/80 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-6 text-gray-700 font-medium">
              <Filter size={14} /> Filters
            </div>
            
            <div className="mb-6">
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Status</h4>
              <div className="space-y-2">
                {['Prospect', 'Lead', 'Client'].map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={statusFilter.includes(status)}
                      onChange={() => toggleFilter("status", status)}
                    />
                    <span className="text-gray-700 text-[13px]">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Lead Status</h4>
              <div className="space-y-2">
                {['Won', 'Lost', 'On-hold', 'Reached out', 'Proposal Sent'].map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={leadStatusFilter.includes(status)}
                      onChange={() => toggleFilter("lead_status", status)}
                    />
                    <span className="text-gray-700 text-[13px]">{status}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col relative">
          {loading && customers.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20 text-gray-500">Loading...</div>
          ) : null}
          
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search customers..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="text-[13px] text-gray-500">
              {customers.length} records
            </div>
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      checked={customers.length > 0 && selectedIds.size === customers.length} 
                      onChange={toggleSelectAll} 
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Company</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Lead Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Contract Value</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 && !loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-500">No records match your filters.</td></tr>
                ) : (
                  customers.map((c) => (
                    <tr 
                      key={c.id} 
                      onClick={() => handleRowClick(c.id)}
                      className="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                          style={{ opacity: selectedIds.has(c.id) ? 1 : undefined }}
                          checked={selectedIds.has(c.id)} 
                          onChange={(e) => toggleSelect(c.id, e as any)} 
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.company || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          c.status === 'Client' ? 'bg-green-100 text-green-700' :
                          c.status === 'Lead' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {c.status || 'Prospect'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          c.lead_status === 'Won' ? 'bg-green-100 text-green-700' :
                          c.lead_status === 'Lost' ? 'bg-red-100 text-red-700' :
                          c.lead_status === 'Proposal Sent' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {c.lead_status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.role || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.contract_value ? `$${Number(c.contract_value).toLocaleString()}` : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded inline-flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Workspace>
  );
}
