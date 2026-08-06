"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Banknote,
  Eye,
  MousePointerClick,
  Percent,
  Target,
  Coins,
} from "lucide-react";
import type { AdsOverallResult } from "@/lib/reports/aggregation";
import { formatCompact, formatCtr } from "@/lib/reports/meta-ads";
import {
  formatCurrencyAmount,
  formatMultiCurrencySpend,
} from "@/lib/reports/linkedin-ads";

const COLORS = ["#1877f2", "#4285f4", "#0a66c2", "#34a853", "#ea4335"];

interface AdsOverallDashboardProps {
  result: AdsOverallResult;
}

function formatNetworkMoney(amount: number, currency: string) {
  return formatCurrencyAmount(amount, currency || "EUR");
}

function formatTotalsSpend(result: AdsOverallResult): string {
  const totals = result.totals;
  if (!totals) return "—";
  if (totals.mixedCurrency && totals.spendByCurrency.length) {
    return formatMultiCurrencySpend(
      totals.spendByCurrency.map((p) => ({ amount: p.amount, currency: p.currency }))
    );
  }
  return formatCurrencyAmount(totals.spend, totals.currency || "EUR");
}

export function AdsOverallDashboard({ result }: AdsOverallDashboardProps) {
  const totals = result.totals!;
  const networks = result.networks;

  const spendDonut = useMemo(
    () => networks.map((n) => ({ name: n.label, value: n.spend })),
    [networks]
  );

  const efficiency = useMemo(
    () =>
      networks.map((n) => ({
        name: n.label,
        cpc: Number(n.cpc.toFixed(3)),
        cpa: Number(n.cpa.toFixed(3)),
      })),
    [networks]
  );

  const moneyLabel = totals.mixedCurrency
    ? "Source currencies (no FX)"
    : totals.currency || "EUR";

  return (
    <div className="space-y-5">
      <div className="text-[12px] font-medium px-3 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-100">
        {result.notice}
        {totals.mixedCurrency && (
          <span className="block mt-1 text-sky-700">
            Spend is shown in each network&apos;s export currency (LinkedIn USD is not converted to
            EUR).
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Total ad spend", value: formatTotalsSpend(result), icon: Banknote },
          { label: "Paid impressions", value: formatCompact(totals.impressions), icon: Eye },
          { label: "Paid clicks", value: formatCompact(totals.clicks), icon: MousePointerClick },
          { label: "Blended CTR", value: formatCtr(totals.ctr), icon: Percent },
          { label: "Conversions", value: formatCompact(totals.conversions), icon: Target },
          {
            label: totals.mixedCurrency ? "Blended CPA (approx.)" : "Blended CPA",
            value: totals.mixedCurrency
              ? "—"
              : formatCurrencyAmount(totals.cpa, totals.currency || "EUR"),
            icon: Coins,
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {c.label}
                </p>
                <Icon size={14} className="text-indigo-600" />
              </div>
              <p className="text-[18px] xl:text-[20px] font-bold text-gray-900 tabular-nums leading-tight">
                {c.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-[14px] font-bold text-gray-900 mb-1">Spend by network</h3>
          <p className="text-[12px] text-gray-500 mb-4">
            Share of total ad spend by network ({moneyLabel}).
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spendDonut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {spendDonut.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _n, item) => {
                    const net = networks.find((n) => n.label === item?.payload?.name);
                    return formatNetworkMoney(Number(v ?? 0), net?.currency || "EUR");
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-[14px] font-bold text-gray-900 mb-1">Efficiency by network</h3>
          <p className="text-[12px] text-gray-500 mb-4">CPC and CPA in each network&apos;s currency.</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiency}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cpc" name="CPC" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cpa" name="CPA" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-[14px] font-bold text-gray-900">Network breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5">Network</th>
                <th className="text-right px-4 py-2.5">Ad spend</th>
                <th className="text-right px-4 py-2.5">Impressions</th>
                <th className="text-right px-4 py-2.5">Clicks</th>
                <th className="text-right px-4 py-2.5">CTR</th>
                <th className="text-right px-4 py-2.5">CPC</th>
                <th className="text-right px-4 py-2.5">Conversions</th>
                <th className="text-right px-4 py-2.5">CPA</th>
                <th className="text-right px-4 py-2.5">% Conv share</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.id} className="border-t border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{n.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatNetworkMoney(n.spend, n.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCompact(n.impressions)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCompact(n.clicks)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCtr(n.ctr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatNetworkMoney(n.cpc, n.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCompact(n.conversions)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatNetworkMoney(n.cpa, n.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {n.conversionShare.toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                <td className="px-4 py-2.5">Total (blended)</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatTotalsSpend(result)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCompact(totals.impressions)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCompact(totals.clicks)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCtr(totals.ctr)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {totals.mixedCurrency
                    ? "—"
                    : formatCurrencyAmount(totals.cpc, totals.currency || "EUR")}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCompact(totals.conversions)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {totals.mixedCurrency
                    ? "—"
                    : formatCurrencyAmount(totals.cpa, totals.currency || "EUR")}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
