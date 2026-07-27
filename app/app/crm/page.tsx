"use client";

import { useState, useEffect } from "react";
import { Plus, Filter, Trash, Edit2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function CRMListView() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
    if (selected.length === customers.length) setSelected([]);
    else setSelected(customers.map((c) => c.id));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selected.length} record(s)?`)) return;

    setDeleting(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("crm_customers")
      .delete()
      .in("id", selected);
    
    setDeleting(false);
    if (error) {
      alert("Error deleting: " + error.message);
    } else {
      setSelected([]);
      fetchCustomers();
    }
  };

  const toggleFilter = (type: "status" | "lead_status", value: string) => {
    if (type === "status") {
      setStatusFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else {
      setLeadStatusFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white text-[13px]">
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">CRM Directory</h2>
          <span className="text-gray-500 font-medium">{customers.length} records</span>
        </div>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Trash size={14} /> Delete {selected.length}
            </button>
          )}
          <Link href="/app/crm/bulk-import" className="px-3 py-1.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            Bulk Import
          </Link>
          <Link href="/app/crm/new" className="px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={14} /> Add Lead / Client
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Working Filters Sidebar */}
        <div className="w-56 border-r border-gray-200 p-4 overflow-y-auto hidden md:block shrink-0 bg-gray-50/50">
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
                  <span className="text-gray-700">{status}</span>
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
                  <span className="text-gray-700">{status}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white relative">
          {loading && customers.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20 text-gray-500">Loading...</div>
          ) : null}
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200 shadow-sm">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="rounded border-gray-300" checked={selected.length === customers.length && customers.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Lead Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500">Contract Value</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && !loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-500">No records match your filters.</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className={`rounded border-gray-300 transition-opacity ${selected.includes(c.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                        checked={selected.includes(c.id)} 
                        onChange={() => toggleSelect(c.id)} 
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/app/crm/${c.id}`} className="hover:text-blue-600 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.company || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        c.status === 'Client' ? 'bg-green-100 text-green-700' :
                        c.status === 'Lead' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {c.status || 'Prospect'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
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
                      <Link href={`/app/crm/${c.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded inline-flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 size={14} />
                      </Link>
                    </td>
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
