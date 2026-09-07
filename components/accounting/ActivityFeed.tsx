"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fetchActivity } from "@/lib/accounting/queries";
import { formatEuro, type LedgerActivity } from "@/lib/accounting/types";

type Props = {
  limit?: number;
  projectId?: string;
  /** Bump after ledger sync / hygiene so new pillar moves show up. */
  refreshKey?: number;
};

function asAmount(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function ActivityFeed({ limit = 12, projectId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<LedgerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      // When filtering to one project, over-fetch then filter so we don't miss
      // that project's events buried past the global limit.
      const fetchLimit = projectId ? Math.max(limit * 8, 80) : limit;
      const data = (await fetchActivity(supabase, fetchLimit)) as LedgerActivity[];
      const scoped = projectId ? data.filter((d) => d.project_id === projectId) : data;
      setItems(scoped.slice(0, limit));
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, [limit, projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Activity size={14} className="text-gray-400" />
        <h4 className="text-[13px] font-bold text-gray-900">Recent activity</h4>
      </div>
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-[12px] text-gray-400">Loading…</div>
        ) : error ? (
          <div className="p-4 text-[12px] text-red-600">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-[12px] text-gray-400">No activity yet.</div>
        ) : (
          items.map((item) => {
            const revenue = asAmount(item.revenue_amount);
            const cost = asAmount(item.cost_amount);
            return (
              <div key={item.id} className="px-4 py-3 text-[12px]">
                <p className="text-gray-800">{item.message}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                  <span>
                    {new Date(item.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {revenue !== 0 && (
                    <span className="text-green-600">+{formatEuro(revenue)}</span>
                  )}
                  {cost !== 0 && (
                    <span className="text-red-500">-{formatEuro(cost)}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
