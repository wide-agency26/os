"use client";

import { useState, useEffect } from "react";
import { Plus, Filter, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function TaskListView() {
  const [viewMode, setViewMode] = useState<'list'|'kanban'>('list');
  const [selected, setSelected] = useState<string[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("erp_tasks")
        .select(`
          id, 
          title, 
          status, 
          priority, 
          due_date,
          progress,
          project:project_id ( title ),
          assignee:assigned_to ( full_name )
        `)
        .order("created_at", { ascending: false });
      
      setTasks(data || []);
      setLoading(false);
    }
    fetchTasks();
  }, []);

  const toggleSelectAll = () => {
    if (selected.length === tasks.length) setSelected([]);
    else setSelected(tasks.map((t) => t.id));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white text-[13px]">
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Task</h2>
          <span className="text-gray-500 font-medium">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-[13px] font-medium rounded-sm transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              List
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 text-[13px] font-medium rounded-sm transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Kanban
            </button>
          </div>
          <Link href="/app/projects/task/new" className="px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={14} /> Add Task
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

        <div className="flex-1 overflow-auto bg-gray-50 p-4">
          {viewMode === 'list' ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" className="rounded border-gray-300" checked={selected.length === tasks.length && tasks.length > 0} onChange={toggleSelectAll} />
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500">Task Name</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Project</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Assignee</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Due Date</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading tasks...</td></tr>
                  ) : tasks.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-500">No tasks found. Create one!</td></tr>
                  ) : (
                    tasks.map((t) => (
                      <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                        <td className="px-4 py-3">
                          <input type="checkbox" className="rounded border-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" checked={selected.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{t.title}</td>
                        <td className="px-4 py-3 text-gray-600">{t.project?.title || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            t.status === 'Done' ? 'bg-green-100 text-green-700' :
                            t.status === 'Review' ? 'bg-purple-100 text-purple-700' :
                            t.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                            t.status === 'Cancelled' ? 'bg-gray-100 text-gray-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{t.assignee?.full_name || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-gray-600">{t.due_date || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex gap-4 h-full min-w-max pb-4">
              {['Open', 'In Progress', 'Review', 'Done', 'Cancelled'].map((status) => {
                const columnTasks = tasks.filter(t => t.status === status);
                return (
                  <div key={status} className="w-80 flex flex-col bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-700">{status}</h3>
                      <span className="bg-gray-200 text-gray-600 text-[11px] px-2 py-0.5 rounded-full font-medium">{columnTasks.length}</span>
                    </div>
                    <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                      {columnTasks.map(t => (
                        <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-blue-400 hover:shadow transition-all cursor-pointer group">
                          <h4 className="font-medium text-gray-900 mb-1 leading-snug">{t.title}</h4>
                          <p className="text-[11px] text-gray-500 mb-3">{t.project?.title || 'No Project'}</p>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
                              {t.assignee?.full_name || 'Unassigned'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              t.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                              t.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                              t.priority === 'Low' ? 'bg-gray-100 text-gray-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {t.priority || 'Normal'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {columnTasks.length === 0 && (
                        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                          No {status.toLowerCase()} tasks
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
