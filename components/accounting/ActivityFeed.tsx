"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fetchActivity } from "@/lib/accounting/queries";
import { formatEuro, type LedgerActivity } from "@/lib/accounting/types";

type Props = {
  limit?: number;
  projectId?: string;
};

export function ActivityFeed({ limit = 12, projectId }: Props) {
  const [items, setItems] = useState<LedgerActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const data = (await fetchActivity(supabase, limit)) as LedgerActivity[];
      if (!active) return;
      setItems(projectId ? data.filter((d) => d.project_id === projectId) : data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [limit, projectId]);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Activity size={14} className="text-gray-400" />
        <h4 className="text-[13px] font-bold text-gray-900">Recent activity</h4>
      </div>
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-[12px] text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-[12px] text-gray-400">No activity yet.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="px-4 py-3 text-[12px]">
              <p className="text-gray-800">{item.message}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                <span>
                  {new Date(item.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                {item.revenue_amount != null && Number(item.revenue_amount) !== 0 && (
                  <span className="text-green-600">+{formatEuro(item.revenue_amount)}</span>
                )}
                {item.cost_amount != null && Number(item.cost_amount) !== 0 && (
                  <span className="text-red-500">-{formatEuro(item.cost_amount)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
