import Link from "next/link";
import { formatEuro } from "@/lib/accounting/types";
import { Panel } from "@/components/frappe-ui/primitives";
import { DealReviewCard } from "@/components/bd/DealReviewCard";
import type { FounderHomeBooksData } from "@/lib/home/load-founder";
import { workPaths } from "@/lib/work/paths";

export function HomeDeals({ deals }: { deals: FounderHomeBooksData["pendingDeals"] }) {
  if (!deals.length) return null;
  return (
    <div id="deal-finder">
      <Panel className="mb-3 overflow-hidden">
        <div className="px-3 py-2 bg-surface-raised flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Deal Finder
          </p>
          <Link
            href={workPaths.toolsFind}
            className="text-[12px] font-medium text-text-secondary hover:text-text-primary"
          >
            Open finder
          </Link>
        </div>
        {deals.map((deal) => (
          <div key={deal.id} className="border-t border-border">
            <DealReviewCard deal={deal} />
          </div>
        ))}
      </Panel>
    </div>
  );
}

export function HomeBooks({ data }: { data: FounderHomeBooksData }) {
  const pipeline = {
    profit: data.pillars.identified.profit + data.pillars.unidentified.profit,
  };

  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
        Books
      </h3>
      <Panel className="overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:divide-x divide-y sm:divide-y-0 divide-border">
          <Link
            href="/app/accounting/actual"
            className="flex-1 px-4 py-3 hover:bg-surface-raised transition-colors"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Actual
            </p>
            <p
              className={`text-lg font-semibold mt-1 tabular-nums ${
                data.pillars.actual.profit >= 0 ? "text-text-primary" : "text-danger"
              }`}
            >
              {formatEuro(data.pillars.actual.profit)}
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {formatEuro(data.pillars.actual.revenue)} in ·{" "}
              {formatEuro(data.pillars.actual.cost)} out
            </p>
          </Link>
          <div className="flex-1 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Pipeline
            </p>
            <p
              className={`text-lg font-semibold mt-1 tabular-nums ${
                pipeline.profit >= 0 ? "text-text-primary" : "text-danger"
              }`}
            >
              {formatEuro(pipeline.profit)}
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              <Link href="/app/accounting/identified" className="hover:underline">
                Identified {formatEuro(data.pillars.identified.profit)}
              </Link>
              {" · "}
              <Link href="/app/accounting/unidentified" className="hover:underline">
                Unidentified {formatEuro(data.pillars.unidentified.profit)}
              </Link>
            </p>
          </div>
          <Link
            href="/app/accounting/runway"
            className="flex-1 px-4 py-3 hover:bg-surface-raised transition-colors"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Runway
            </p>
            <p className="text-lg font-semibold mt-1 tabular-nums text-text-primary">
              {data.runway.months == null ? "Growing" : `${data.runway.months} mo`}
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Cash {formatEuro(data.runway.cash)}
              {data.runway.monthlyNet < 0
                ? ` · burn ${formatEuro(Math.abs(data.runway.monthlyNet))}/mo`
                : ` · net ${formatEuro(data.runway.monthlyNet)}/mo`}
            </p>
          </Link>
        </div>
      </Panel>
      <p className="text-[12px] text-text-muted mt-2 tabular-nums">
        <Link href="/app/accounting/actual" className="hover:text-text-primary">
          {formatEuro(data.actualProfit)} FY profit
        </Link>
      </p>
    </section>
  );
}
