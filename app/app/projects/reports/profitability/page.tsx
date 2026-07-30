"use client";

import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

export default function ProjectProfitabilityReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ estimated: 0, actual: 0, billed: 0, margin: 0 });

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      // Fetch all projects with their tasks and timesheets aggregated
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title, status, estimated_cost, start_date, end_date")
        .order("title");

      if (!projects) { setLoading(false); return; }

      const enriched = await Promise.all(projects.map(async (p: any) => {
        // Timesheet cost
        const { data: timesheets } = await (supabase as any)
          .from("erp_timesheets")
          .select("hours, billing_rate")
          .eq("project_id", p.id);
        const timesheetCost = (timesheets || []).reduce((sum: number, ts: any) =>
          sum + (Number(ts.hours) * Number(ts.billing_rate || 0)), 0);

        // Expense cost
        const { data: expenses } = await (supabase as any)
          .from("erp_expenses")
          .select("amount")
          .eq("project_id", p.id);
        const expenseCost = (expenses || []).reduce((sum: number, e: any) =>
          sum + Number(e.amount || 0), 0);

        // Billed amount
        const { data: invoices } = await (supabase as any)
          .from("erp_invoices")
          .select("grand_total")
          .eq("project_id", p.id)
          .neq("status", "Cancelled");
        const billed = (invoices || []).reduce((sum: number, i: any) =>
          sum + Number(i.grand_total || 0), 0);

        const actualCost = timesheetCost + expenseCost;
        const margin = billed - actualCost;

        return {
          ...p,
          estimated: Number(p.estimated_cost || 0),
          actual: actualCost,
          billed,
          margin,
          marginPct: billed > 0 ? Math.round((margin / billed) * 100) : 0,
        };
      }));

      setRows(enriched);
      setTotals({
        estimated: enriched.reduce((s, r) => s + r.estimated, 0),
        actual: enriched.reduce((s, r) => s + r.actual, 0),
        billed: enriched.reduce((s, r) => s + r.billed, 0),
        margin: enriched.reduce((s, r) => s + r.margin, 0),
      });
      setLoading(false);
    }
    fetchData();
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/app/projects" className="p-2 hover:bg-gray-100 rounded transition-colors"><ArrowLeft size={20} className="text-gray-600" /></Link>
          <h2 className="text-2xl font-bold text-gray-900">Project Profitability</h2>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Estimated", value: fmt(totals.estimated), color: "text-gray-900" },
          { label: "Total Actual Cost", value: fmt(totals.actual), color: "text-red-600" },
          { label: "Total Billed", value: fmt(totals.billed), color: "text-blue-600" },
          { label: "Gross Margin", value: fmt(totals.margin), color: totals.margin >= 0 ? "text-green-600" : "text-red-600" },
        ].map(card => (
          <div key={card.label} className="p-4 rounded-lg border border-gray-200 bg-white">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
            <h3 className={`text-xl font-semibold ${card.color}`}>{loading ? "..." : card.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Project</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Estimated</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Actual Cost</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Billed</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Margin</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No projects found.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/app/projects/${r.id}`} className="hover:text-blue-600 hover:underline">{r.title}</Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    r.status === "completed" ? "bg-green-100 text-green-700" :
                    r.status === "running" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(r.estimated)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(r.actual)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(r.billed)}</td>
                <td className={`px-4 py-3 text-right font-medium ${r.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(r.margin)}</td>
                <td className={`px-4 py-3 text-right font-medium ${r.marginPct >= 0 ? "text-green-600" : "text-red-600"}`}>{r.marginPct}%</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr className="font-semibold">
                <td className="px-4 py-3 text-gray-900" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmt(totals.estimated)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmt(totals.actual)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmt(totals.billed)}</td>
                <td className={`px-4 py-3 text-right ${totals.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(totals.margin)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{totals.billed > 0 ? Math.round((totals.margin / totals.billed) * 100) : 0}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Workspace>
  );
}
