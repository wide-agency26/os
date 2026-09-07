"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEuroExact } from "@/lib/accounting/types";
import {
  defaultFounderHoursPerMonth,
  formatRate,
  formatRunwayMonths,
  founderMonthlyDraw,
  monthsOfCash,
  type FounderRatePerson,
} from "@/lib/accounting/founder-runway";

export function FounderCashRunwayCard({
  cash,
  founders,
}: {
  cash: number;
  founders: FounderRatePerson[];
}) {
  const [hours, setHours] = useState(() => defaultFounderHoursPerMonth(founders));

  const sim = useMemo(() => {
    const hoursPerMonth = Number(hours) > 0 ? Number(hours) : 0;
    const rows = founders.map((p) => {
      const currentRate = Number(p.hourly_rate_cost || 0);
      const wishlistSet = p.wishlist_hourly_rate != null && Number(p.wishlist_hourly_rate) > 0;
      const wishlistRate = wishlistSet ? Number(p.wishlist_hourly_rate) : currentRate;
      return {
        id: p.id,
        name: p.full_name,
        currentRate,
        wishlistRate,
        wishlistSet,
        currentMonth: founderMonthlyDraw(currentRate, hoursPerMonth),
        wishlistMonth: founderMonthlyDraw(wishlistRate, hoursPerMonth),
      };
    });
    const currentTotal = rows.reduce((s, r) => s + r.currentMonth, 0);
    const wishlistTotal = rows.reduce((s, r) => s + r.wishlistMonth, 0);
    const wishlistMissing = rows.filter((r) => !r.wishlistSet);
    return {
      rows,
      currentTotal,
      wishlistTotal,
      currentMonths: monthsOfCash(cash, currentTotal),
      wishlistMonths: monthsOfCash(cash, wishlistTotal),
      wishlistMissing,
    };
  }, [founders, hours, cash]);

  return (
    <div className="p-5 rounded-lg border border-gray-200 bg-white mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Founder cash
          </p>
          <h3 className="text-[15px] font-semibold text-gray-900 mt-0.5">
            How long Ali and Thomas last on cash only
          </h3>
          <p className="text-[12px] text-gray-500 mt-1 max-w-xl">
            Ignores ledger burn and Lexware. Pays both founders at the hourly
            rate × hours below until cash hits zero.
          </p>
        </div>
        <label className="text-[12px] text-gray-600">
          Hours / month each
          <input
            type="number"
            min={1}
            step={1}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value) || 0)}
            className="mt-1 block w-28 border border-gray-200 rounded-md px-2.5 py-1.5 text-[13px] tabular-nums"
          />
        </label>
      </div>

      {founders.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          No active founders on the HR roster. Mark Ali and Thomas as Founder /
          Core on{" "}
          <Link href="/app/hr" className="text-blue-700 hover:underline">
            HR
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Current rate
              </p>
              <p className="text-2xl font-semibold text-gray-900 tabular-nums mt-1">
                {formatRunwayMonths(sim.currentMonths)}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                {formatEuroExact(sim.currentTotal)} / mo for both
              </p>
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Wishlist rate
              </p>
              <p className="text-2xl font-semibold text-gray-900 tabular-nums mt-1">
                {formatRunwayMonths(sim.wishlistMonths)}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                {formatEuroExact(sim.wishlistTotal)} / mo for both
                {sim.wishlistMissing.length > 0
                  ? ` · ${sim.wishlistMissing.map((r) => r.name).join(", ")} still on current`
                  : ""}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="pb-2 font-semibold">Founder</th>
                  <th className="pb-2 font-semibold">Current</th>
                  <th className="pb-2 font-semibold">Wishlist</th>
                  <th className="pb-2 font-semibold">At current</th>
                  <th className="pb-2 font-semibold">At wishlist</th>
                </tr>
              </thead>
              <tbody>
                {sim.rows.map((r) => (
                  <tr key={r.id} className="text-[13px]">
                    <td className="py-1.5 pr-3">
                      <Link href={`/app/hr/${r.id}`} className="font-medium text-gray-900 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums text-gray-600">{formatRate(r.currentRate)}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-gray-600">
                      {r.wishlistSet ? (
                        formatRate(r.wishlistRate)
                      ) : (
                        <Link href={`/app/hr/${r.id}`} className="text-blue-700 hover:underline">
                          Set on HR
                        </Link>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums text-gray-600">
                      {formatEuroExact(r.currentMonth)} / mo
                    </td>
                    <td className="py-1.5 tabular-nums text-gray-600">
                      {formatEuroExact(r.wishlistMonth)} / mo
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
