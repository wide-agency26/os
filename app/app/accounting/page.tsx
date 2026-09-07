"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PageHeader } from "@/components/frappe-ui/primitives";
import { Scorecard } from "@/components/accounting/Scorecard";
import { AccountingTrendChart } from "@/components/accounting/AccountingTrendChart";
import { LedgerBrowseView } from "@/components/accounting/LedgerBrowseView";
import { ActivityFeed } from "@/components/accounting/ActivityFeed";
import {
  DateMonthFilter,
  defaultFyFilter,
  isMonthInFilter,
  type DateMonthFilterValue,
} from "@/components/accounting/DateMonthFilter";
import {
  fetchCashBalances,
  fetchLedgerEntries,
  monthlySeriesChronological,
  totals,
} from "@/lib/accounting/queries";
import {
  formatEuro,
  LEDGER_PILLAR_UI,
  type LedgerEntry,
  type LedgerPillar,
} from "@/lib/accounting/types";

function avgMonthlyNetActual(entries: LedgerEntry[], trailingMonths = 3): number {
  const series = monthlySeriesChronological(entries);
  const last = series.slice(-trailingMonths);
  if (last.length === 0) return 0;
  const sum = last.reduce((s, m) => s + (m.revenue - m.cost), 0);
  return sum / last.length;
}

function avgMonthlyNetPipeline(entries: LedgerEntry[]): number {
  const series = monthlySeriesChronological(entries);
  if (series.length === 0) return 0;
  const sum = series.reduce((s, m) => s + (m.revenue - m.cost), 0);
  return sum / 12;
}

export default function AccountingDashboardPage() {
  const [filter, setFilter] = useState<DateMonthFilterValue>(() => defaultFyFilter());
  const [data, setData] = useState<Record<LedgerPillar, LedgerEntry[]>>({
    actual: [],
    identified: [],
    unidentified: [],
  });
  const [cash, setCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<LedgerPillar | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const year = new Date().getFullYear();
    const [unidentified, identified, actual, cashRows] = await Promise.all([
      fetchLedgerEntries(supabase, {
        pillar: "unidentified",
        startDate: filter.startDate,
        endDate: filter.endDate,
      }),
      fetchLedgerEntries(supabase, {
        pillar: "identified",
        startDate: filter.startDate,
        endDate: filter.endDate,
      }),
      fetchLedgerEntries(supabase, {
        pillar: "actual",
        startDate: filter.startDate,
        endDate: filter.endDate,
      }),
      fetchCashBalances(supabase, `${year - 1}-01-01`, `${year + 1}-12-31`),
    ]);
    setData({ actual, identified, unidentified });
    const last = (cashRows as { amount?: number }[]).at(-1);
    setCash(Number(last?.amount || 0));
    setLoading(false);
  }, [filter.startDate, filter.endDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function scoped(pillar: LedgerPillar) {
    return data[pillar].filter((e) => isMonthInFilter(filter.months, e.entry_date));
  }

  const chartSeries = useMemo(
    () => ({
      unidentified: scoped("unidentified"),
      identified: scoped("identified"),
      actual: scoped("actual"),
    }),
    [data, filter.months]
  );

  const summaries = useMemo(() => {
    const out: Record<LedgerPillar, ReturnType<typeof totals>> = {
      actual: totals(scoped("actual")),
      identified: totals(scoped("identified")),
      unidentified: totals(scoped("unidentified")),
    };
    return out;
  }, [data, filter.months]);

  const actualNet = useMemo(
    () => avgMonthlyNetActual(data.actual),
    [data.actual]
  );
  const identifiedNet = useMemo(
    () => avgMonthlyNetPipeline(data.identified),
    [data.identified]
  );
  const baseNet = actualNet + identifiedNet * 0.5;
  const monthsRunway =
    baseNet >= 0 ? null : cash <= 0 ? 0 : Math.floor(cash / Math.abs(baseNet));

  function togglePillar(pillar: LedgerPillar) {
    setExpanded((prev) => (prev === pillar ? null : pillar));
  }

  return (
    <Workspace wide>
      <PageHeader
        title="Accounting"
        subtitle="Actual is the books. Identified and Unidentified sit beside it as pipeline. Click a card for the table and calendar."
      />

      <div className="mb-6">
        <DateMonthFilter value={filter} onChange={setFilter} />
      </div>

      {loading ? null : (
        <AccountingTrendChart filter={filter} series={chartSeries} />
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center text-text-muted text-[13px] gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading ledger…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
            <div className="lg:col-span-3">
              <Scorecard
                title={LEDGER_PILLAR_UI.actual.title}
                revenue={summaries.actual.revenue}
                cost={summaries.actual.cost}
                profit={summaries.actual.profit}
                pillarStyle="actual"
                size="featured"
                selected={expanded === "actual"}
                onSelect={() => togglePillar("actual")}
              />
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {(["identified", "unidentified"] as LedgerPillar[]).map((key) => (
                <Scorecard
                  key={key}
                  title={LEDGER_PILLAR_UI[key].title}
                  revenue={summaries[key].revenue}
                  cost={summaries[key].cost}
                  profit={summaries[key].profit}
                  pillarStyle={key}
                  size="compact"
                  selected={expanded === key}
                  onSelect={() => togglePillar(key)}
                />
              ))}
            </div>
          </div>

          {expanded ? (
            <div className="mb-8">
              <LedgerBrowseView
                pillar={expanded}
                entries={scoped(expanded)}
                onClose={() => setExpanded(null)}
              />
            </div>
          ) : (
            <div className="mb-8" />
          )}
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Link
          href="/app/accounting/runway"
          className="p-4 rounded-lg border border-border bg-surface hover:border-text-muted transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Runway
              </p>
              <p className="text-2xl font-semibold text-text-primary tabular-nums mt-1">
                {monthsRunway == null
                  ? "Growing"
                  : `${monthsRunway} mo`}
              </p>
              <p className="text-[12px] text-text-secondary mt-1">
                Cash {formatEuro(cash)}
                {baseNet < 0
                  ? ` · burn ${formatEuro(Math.abs(baseNet))}/mo`
                  : ` · net ${formatEuro(baseNet)}/mo`}
                {" · base"}
              </p>
            </div>
            <ArrowRight size={16} strokeWidth={1.75} className="text-text-muted mt-1 shrink-0" />
          </div>
        </Link>
        <Link
          href="/app/accounting/projections"
          className="p-4 rounded-lg border border-border bg-surface hover:border-text-muted transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Projections
              </p>
              <p className="text-[15px] font-semibold text-text-primary mt-1">
                2027–2031
              </p>
              <p className="text-[12px] text-text-secondary mt-1">
                Catalog-backed unidentified P&amp;L. Push a year into the ledger.
              </p>
            </div>
            <ArrowRight size={16} strokeWidth={1.75} className="text-text-muted mt-1 shrink-0" />
          </div>
        </Link>
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
      </div>
    </Workspace>
  );
}
