"use client";

import { useState, useEffect } from "react";
import { Plus, Filter } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";

export default function CRMListView() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomers() {
      const supabase = createClient();
      const { data } = await (supabase as any)
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
      
      setCustomers(data || []);
      setLoading(false);
    }
    fetchCustomers();
  }, []);

  const toggleSelectAll = () => {
    if (selected.length === customers.length) setSelected([]);
    else setSelected(customers.map((c) => c.id));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white text-[13px]">
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">CRM Directory</h2>
          <span className="text-gray-500 font-medium">{customers.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app/accounting/customer/bulk-import" className="px-3 py-1.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            Bulk Import
          </Link>
          <Link href="/app/accounting/customer/new" className="px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={14} /> Add Lead / Client
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
                  <input type="checkbox" className="rounded border-gray-300" checked={selected.length === customers.length && customers.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Lead Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500">Contract Value</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading directory...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">No records found. Create one!</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
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
