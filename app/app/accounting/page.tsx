"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { Scorecard } from "@/components/accounting/Scorecard";
import { ActivityFeed } from "@/components/accounting/ActivityFeed";
import {
  DateMonthFilter,
  defaultFyFilter,
  isMonthInFilter,
  type DateMonthFilterValue,
} from "@/components/accounting/DateMonthFilter";
import { aggregateMonthly, fetchLedgerEntries, totals } from "@/lib/accounting/queries";
import type { LedgerEntry, LedgerPillar } from "@/lib/accounting/types";

const PILLARS: { key: LedgerPillar; label: string; href: string; blurb: string }[] = [
  {
    key: "unidentified",
    label: "Unidentified",
    href: "/app/accounting/unidentified",
    blurb: "Pipeline estimates & speculative revenue/cost",
  },
  {
    key: "identified",
    label: "Identified",
    href: "/app/accounting/identified",
    blurb: "Prospect deals not yet signed",
  },
  {
    key: "actual",
    label: "Actual",
    href: "/app/accounting/actual",
    blurb: "Signed revenue & real costs — HR, overhead, delivered projects",
  },
];

export default function AccountingDashboardPage() {
  const [filter, setFilter] = useState<DateMonthFilterValue>(() => defaultFyFilter());
  const [data, setData] = useState<Record<LedgerPillar, LedgerEntry[]>>({
    actual: [],
    identified: [],
    unidentified: [],
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [actual, identified, unidentified] = await Promise.all(
      PILLARS.map((p) =>
        fetchLedgerEntries(supabase, {
          pillar: p.key,
          startDate: filter.startDate,
          endDate: filter.endDate,
        })
      )
    );
    setData({ actual, identified, unidentified });
    setLoading(false);
  }, [filter.startDate, filter.endDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function scoped(pillar: LedgerPillar) {
    return data[pillar].filter((e) => isMonthInFilter(filter.months, e.entry_date));
  }

  return (
    <Workspace wide>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Accounting</h2>
        <p className="text-gray-500 mt-1 text-[13px]">
          Unidentified → Identified → Actual revenue &amp; cost pipeline.
        </p>
      </div>

      <div className="mb-6">
        <DateMonthFilter value={filter} onChange={setFilter} />
      </div>

      {/* Flow strip */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-1">
        {PILLARS.map((p, idx) => (
          <div key={p.key} className="flex items-center gap-3 shrink-0">
            <Link
              href={p.href}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              {p.label}
            </Link>
            {idx < PILLARS.length - 1 && <ArrowRight size={16} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-gray-400 text-[13px] gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading ledger…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {PILLARS.map((p) => {
            const entries = scoped(p.key);
            const t = totals(entries);
            const monthly = aggregateMonthly(entries);
            return (
              <Scorecard
                key={p.key}
                title={p.label}
                revenue={t.revenue}
                cost={t.cost}
                profit={t.profit}
                monthlySeries={monthly}
                pillarStyle={p.key}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {PILLARS.map((p) => (
          <Link
            key={p.key}
            href={p.href}
            className="group flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Open {p.label}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{p.blurb}</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 ml-3" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link
          href="/app/accounting/runway"
          className="lg:col-span-1 p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet size={16} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Runway</p>
              <p className="text-[11px] text-gray-500">Cash, burn &amp; scenarios</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-300 mt-4 self-end" />
        </Link>
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
      </div>
    </Workspace>
  );
}
