"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function BillingSummaryReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ billableHours: 0, billingAmount: 0, billed: 0, unbilled: 0 });

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title, status")
        .order("title");

      if (!projects) { setLoading(false); return; }

      const enriched = await Promise.all(projects.map(async (p: any) => {
        // Billable timesheets
        const { data: timesheets } = await (supabase as any)
          .from("erp_timesheets")
          .select("hours, billing_rate, is_billable")
          .eq("project_id", p.id)
          .eq("is_billable", true);

        const billableHours = (timesheets || []).reduce((s: number, t: any) => s + Number(t.hours), 0);
        const billingAmount = (timesheets || []).reduce((s: number, t: any) =>
          s + (Number(t.hours) * Number(t.billing_rate || 0)), 0);

        // Billed invoices
        const { data: invoices } = await (supabase as any)
          .from("erp_invoices")
          .select("grand_total")
          .eq("project_id", p.id)
          .in("status", ["Paid", "Sent", "Partially Paid"]);

        const billed = (invoices || []).reduce((s: number, i: any) => s + Number(i.grand_total || 0), 0);
        const unbilled = billingAmount - billed;

        return { ...p, billableHours, billingAmount, billed, unbilled };
      }));

      setRows(enriched);
      setTotals({
        billableHours: enriched.reduce((s, r) => s + r.billableHours, 0),
        billingAmount: enriched.reduce((s, r) => s + r.billingAmount, 0),
        billed: enriched.reduce((s, r) => s + r.billed, 0),
        unbilled: enriched.reduce((s, r) => s + r.unbilled, 0),
      });
      setLoading(false);
    }
    fetchData();
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  return (
    <Workspace>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/app/projects" className="p-2 hover:bg-gray-100 rounded transition-colors"><ArrowLeft size={20} className="text-gray-600" /></Link>
        <h2 className="text-2xl font-bold text-gray-900">Project Billing Summary</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Billable Hours", value: loading ? "..." : `${totals.billableHours.toFixed(1)}h`, color: "text-gray-900" },
          { label: "Billing Amount", value: loading ? "..." : fmt(totals.billingAmount), color: "text-blue-600" },
          { label: "Amount Billed", value: loading ? "..." : fmt(totals.billed), color: "text-green-600" },
          { label: "Unbilled", value: loading ? "..." : fmt(totals.unbilled), color: totals.unbilled > 0 ? "text-orange-600" : "text-gray-600" },
        ].map(c => (
          <div key={c.label} className="p-4 rounded-lg border border-gray-200 bg-white">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{c.label}</p>
            <h3 className={`text-xl font-semibold ${c.color}`}>{c.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Project</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Billable Hours</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Billing Amount</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Amount Billed</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Unbilled</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No projects found.</td></tr>
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
                <td className="px-4 py-3 text-right text-gray-600">{r.billableHours.toFixed(1)}h</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(r.billingAmount)}</td>
                <td className="px-4 py-3 text-right text-green-600 font-medium">{fmt(r.billed)}</td>
                <td className={`px-4 py-3 text-right font-medium ${r.unbilled > 0 ? "text-orange-600" : "text-gray-500"}`}>{fmt(r.unbilled)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr className="font-semibold">
                <td className="px-4 py-3 text-gray-900" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{totals.billableHours.toFixed(1)}h</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmt(totals.billingAmount)}</td>
                <td className="px-4 py-3 text-right text-green-600">{fmt(totals.billed)}</td>
                <td className={`px-4 py-3 text-right ${totals.unbilled > 0 ? "text-orange-600" : "text-gray-500"}`}>{fmt(totals.unbilled)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Workspace>
  );
}
