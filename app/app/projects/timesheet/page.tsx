"use client";

import { useState } from "react";
import { Plus, Filter, MoreHorizontal, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

const MOCK_TIMESHEETS = [
  { id: "TS-2026-0001", employee: "Ali Hashemi", status: "Submitted", total_hours: 8, date: "2026-07-27" },
  { id: "TS-2026-0002", employee: "Thomas Founder", status: "Draft", total_hours: 4.5, date: "2026-07-27" },
  { id: "TS-2026-0003", employee: "Jane Doe", status: "Approved", total_hours: 40, date: "2026-07-20" },
];

export default function TimesheetListView() {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selected.length === MOCK_TIMESHEETS.length) {
      setSelected([]);
    } else {
      setSelected(MOCK_TIMESHEETS.map((t) => t.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white text-[13px]">
      {/* List Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Timesheet</h2>
          <span className="text-gray-500 font-medium">{MOCK_TIMESHEETS.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors">
            List View
          </button>
          <button className="px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={14} />
            Add Timesheet
          </button>
        </div>
      </div>

      {/* Main Content Area with Filter Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Filter Sidebar */}
        <div className="w-56 border-r border-gray-200 p-4 overflow-y-auto hidden md:block shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Filters</h3>
            <Filter size={14} className="text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Assigned To</label>
              <input type="text" placeholder="Search users..." className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Status</label>
              <select className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="">All</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
              </select>
            </div>
          </div>
        </div>

        {/* List View Table */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-gray-50/50 sticky top-0 border-b border-gray-200 z-10">
                <tr>
                  <th className="w-10 px-4 py-2 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selected.length === MOCK_TIMESHEETS.length && MOCK_TIMESHEETS.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Employee</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Total Hours</th>
                  <th className="w-10 px-4 py-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_TIMESHEETS.map((ts) => (
                  <tr key={ts.id} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                    <td className="px-4 py-2.5 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        checked={selected.includes(ts.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(ts.id);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <Link href={`/app/projects/timesheet/${ts.id}`} className="hover:underline">
                        {ts.id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        ts.status === 'Approved' ? 'bg-green-100 text-green-700' :
                        ts.status === 'Submitted' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {ts.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{ts.employee}</td>
                    <td className="px-4 py-2.5 text-gray-600">{ts.total_hours}h</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">
                      <button className="hover:text-gray-700 p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          <div className="h-12 border-t border-gray-200 px-4 flex items-center justify-between text-gray-500 bg-white shrink-0">
            <div>20 records per page</div>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded hover:bg-gray-100 text-gray-400 cursor-not-allowed">
                <ArrowLeft size={14} />
              </button>
              <span className="font-medium text-gray-700">1</span>
              <button className="p-1 rounded hover:bg-gray-100 text-gray-600">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
