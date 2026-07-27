"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Section, ShortcutCard } from "@/components/frappe-ui/Workspace";
import { DollarSign, TrendingDown, TrendingUp, Calendar as CalendarIcon } from "lucide-react";

export function AccountingDashboard() {
  // Default to current year
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  
  const [revenue, setRevenue] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFinancials() {
      setLoading(true);
      const supabase = createClient();

      // Fetch Revenue (Total Invoiced Amount for the period)
      // Only include invoices that aren't Draft or Cancelled
      const { data: invoices } = await (supabase as any)
        .from("erp_invoices")
        .select("grand_total")
        .gte("issue_date", startDate)
        .lte("issue_date", endDate)
        .neq("status", "Draft")
        .neq("status", "Cancelled");

      const totalRevenue = invoices?.reduce((sum: number, inv: any) => sum + Number(inv.grand_total), 0) || 0;

      // Fetch Cost (Total Expenses for the period)
      const { data: expenses } = await (supabase as any)
        .from("erp_expenses")
        .select("amount")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

      const totalCost = expenses?.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0) || 0;

      setRevenue(totalRevenue);
      setCost(totalCost);
      setLoading(false);
    }

    fetchFinancials();
  }, [startDate, endDate]);

  const profit = revenue - cost;

  // Format currency
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 text-gray-500">
          <CalendarIcon size={16} />
          <span className="text-[13px] font-medium">Fiscal Period:</span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-[13px] px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <span className="text-gray-400">to</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-[13px] px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <Section title="Financial Performance">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {/* Total Revenue */}
          <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all group flex items-start justify-between">
            <div>
              <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Revenue</p>
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-semibold text-gray-900 tracking-tight">{formatCurrency(revenue)}</h3>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>

          {/* Total Cost */}
          <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all group flex items-start justify-between">
            <div>
              <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Cost</p>
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-semibold text-gray-900 tracking-tight">{formatCurrency(cost)}</h3>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <TrendingDown size={20} />
            </div>
          </div>

          {/* Total Profit */}
          <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all group flex items-start justify-between">
            <div>
              <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Profit</p>
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className={`text-3xl font-semibold tracking-tight ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profit)}
                </h3>
              )}
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              <DollarSign size={20} />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
