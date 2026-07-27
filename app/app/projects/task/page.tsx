"use client";

import { useState, useEffect } from "react";
import { Plus, Filter, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function TaskListView() {
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
          <Link href="/app/projects/task" className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors">List View</Link>
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

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200 shadow-sm">
              <tr>
                <th className="w-12 px-6 py-3">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" onChange={toggleSelectAll} checked={selected.length === tasks.length && tasks.length > 0} />
                </th>
                <th className="px-6 py-3 font-semibold text-gray-900">Title</th>
                <th className="px-6 py-3 font-semibold text-gray-900">Project</th>
                <th className="px-6 py-3 font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 font-semibold text-gray-900">Progress</th>
                <th className="px-6 py-3 font-semibold text-gray-900">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer ${selected.includes(task.id) ? "bg-blue-50/50" : ""}`}>
                  <td className="w-12 px-6 py-3">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={selected.includes(task.id)} onChange={() => toggleSelect(task.id)} />
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    <Link href={`/app/projects/task/${task.id}`} className="hover:underline">{task.title}</Link>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{task.project?.title || '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                      task.status === "Done" ? "bg-green-100 text-green-700" :
                      task.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                    }`}>{task.status}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${task.progress}%` }}></div>
                      </div>
                      <span className="text-xs">{task.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{task.assignee?.full_name || 'Unassigned'}</td>
                </tr>
              ))}
              {loading && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading tasks...</td></tr>}
              {!loading && tasks.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">No tasks found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
