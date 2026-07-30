"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function DailyTimesheetSummaryReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return {
      from: monday.toISOString().slice(0, 10),
      to: friday.toISOString().slice(0, 10),
    };
  });

  const shiftWeek = (dir: number) => {
    const from = new Date(dateRange.from);
    from.setDate(from.getDate() + dir * 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 4);
    setDateRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("erp_timesheets")
        .select(`
          id, log_date, hours, is_billable, billing_rate,
          person:person_id ( full_name ),
          project:project_id ( title )
        `)
        .gte("log_date", dateRange.from)
        .lte("log_date", dateRange.to)
        .order("log_date", { ascending: true });

      // Group by date → employee
      const grouped: Record<string, any[]> = {};
      (data || []).forEach((ts: any) => {
        const key = ts.log_date;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ts);
      });

      const result = Object.entries(grouped).map(([date, entries]) => ({
        date,
        entries,
        totalHours: entries.reduce((s: number, e: any) => s + Number(e.hours), 0),
        billableHours: entries.filter((e: any) => e.is_billable).reduce((s: number, e: any) => s + Number(e.hours), 0),
      }));

      setRows(result);
      setLoading(false);
    }
    fetchData();
  }, [dateRange]);

  const grandTotal = rows.reduce((s, r) => s + r.totalHours, 0);
  const grandBillable = rows.reduce((s, r) => s + r.billableHours, 0);

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/app/projects" className="p-2 hover:bg-gray-100 rounded transition-colors"><ArrowLeft size={20} className="text-gray-600" /></Link>
          <h2 className="text-2xl font-bold text-gray-900">Daily Timesheet Summary</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-gray-100 rounded transition-colors"><ChevronLeft size={18} className="text-gray-600" /></button>
          <span className="text-[13px] font-medium text-gray-700 min-w-[200px] text-center">{dateRange.from} — {dateRange.to}</span>
          <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-gray-100 rounded transition-colors"><ChevronRight size={18} className="text-gray-600" /></button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Hours</p>
          <h3 className="text-xl font-semibold text-gray-900">{loading ? "..." : grandTotal.toFixed(1)}h</h3>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Billable Hours</p>
          <h3 className="text-xl font-semibold text-blue-600">{loading ? "..." : grandBillable.toFixed(1)}h</h3>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Utilization</p>
          <h3 className="text-xl font-semibold text-green-600">{loading ? "..." : grandTotal > 0 ? Math.round((grandBillable / grandTotal) * 100) : 0}%</h3>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">No timesheets for this period.</div>
        ) : rows.map(day => (
          <div key={day.date} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-[13px] font-semibold text-gray-900">
                {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </h3>
              <span className="text-[12px] text-gray-500 font-medium">{day.totalHours.toFixed(1)}h total · {day.billableHours.toFixed(1)}h billable</span>
            </div>
            <table className="w-full text-left text-[13px]">
              <tbody>
                {day.entries.map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900 font-medium w-48">{e.person?.full_name || "-"}</td>
                    <td className="px-4 py-2 text-gray-600">{e.project?.title || "-"}</td>
                    <td className="px-4 py-2 text-gray-900 font-medium text-right w-20">{e.hours}h</td>
                    <td className="px-4 py-2 text-right w-20">
                      {e.is_billable ? <span className="text-green-600 text-[11px] font-medium">Billable</span> : <span className="text-gray-400 text-[11px]">Non-billable</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Workspace>
  );
}
