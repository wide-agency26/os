"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { packageFamilyFromServices } from "@/lib/pm/attention";

type CustomerRow = {
  id: string;
  start_date: string | null;
  contract_value: number | null;
  services_package: unknown;
  company: string | null;
  name: string;
};

const PACKAGE_COLORS: Record<string, string> = {
  MVB: "#1f2937",
  "Startup Launch": "#374151",
  "Growth Program": "#4b5563",
  "Full-Service": "#6b7280",
  Other: "#9ca3af",
};

export function ClientIntakeChart({ customers }: { customers: CustomerRow[] }) {
  const [open, setOpen] = useState(false);

  const { months, hasValue } = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        total: number;
        MVB: number;
        "Startup Launch": number;
        "Growth Program": number;
        "Full-Service": number;
        Other: number;
      }
    >();

    let anyValue = false;
    for (const c of customers) {
      if (!c.start_date) continue;
      const d = new Date(c.start_date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, {
          month: key,
          total: 0,
          MVB: 0,
          "Startup Launch": 0,
          "Growth Program": 0,
          "Full-Service": 0,
          Other: 0,
        });
      }
      const row = map.get(key)!;
      const value = Number(c.contract_value || 0);
      if (value > 0) anyValue = true;
      const fam = packageFamilyFromServices(c.services_package);
      row.total += value;
      row[fam] += value;
    }

    const months = Array.from(map.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    // Last 12 months max for readability
    return { months: months.slice(-12), hasValue: anyValue };
  }, [customers]);

  return (
    <section className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        Client intake by month
        <span className="text-xs font-normal text-gray-400 ml-1">
          contract signed · value
        </span>
      </button>

      {open ? (
        <div className="px-4 pb-4 border-t border-gray-100">
          {!hasValue ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No contract values yet. Chart uses{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">start_date</code>{" "}
              +{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">contract_value</code>{" "}
              on CRM clients — fill those to see seasonality.
            </p>
          ) : months.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No clients with a start date.
            </p>
          ) : (
            <div className="h-56 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `€${Number(value ?? 0).toLocaleString()}`,
                      String(name),
                    ]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  {(
                    [
                      "MVB",
                      "Startup Launch",
                      "Growth Program",
                      "Full-Service",
                      "Other",
                    ] as const
                  ).map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="intake"
                      fill={PACKAGE_COLORS[key]}
                      radius={key === "Other" ? [2, 2, 0, 0] : 0}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-gray-500">
                {Object.entries(PACKAGE_COLORS).map(([name, color]) => (
                  <span key={name} className="inline-flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ background: color }}
                    />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
