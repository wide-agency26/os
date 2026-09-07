"use client";

import { useMemo } from "react";
import { Panel } from "@/components/frappe-ui/primitives";
import { buildAudienceMix } from "@/lib/audience/mix";
import type { AudienceSegment } from "@/lib/audience/types";

const STATUS: Record<string, string> = {
  finalized: "Finalized",
  accepted: "Accepted",
  draft: "Draft",
};

export function AudienceMixChart({ segments }: { segments: AudienceSegment[] }) {
  const mix = useMemo(() => buildAudienceMix(segments), [segments]);
  if (!segments.length) return null;

  return (
    <Panel className="p-4 mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
        Audience mix
      </p>
      <div
        className="flex h-9 rounded-md overflow-hidden border border-border"
        role="img"
        aria-label="Audience mix by segment"
      >
        {mix.rows.map((row) => (
          <div
            key={row.id}
            className="h-full min-w-[4px]"
            style={{ width: `${Math.max(row.pct, 1.5)}%`, background: row.color }}
            title={`${row.name} · ${row.pct}%`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {mix.rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2 text-[13px]">
            <span
              className="mt-1.5 w-2 h-2 rounded-sm shrink-0"
              style={{ background: row.color }}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-text-primary">{row.name}</span>
              <span className="text-text-muted"> · {row.pct}%</span>
              {row.sizeLabel ? (
                <span className="block text-[12px] text-text-secondary truncate">
                  {row.sizeLabel}
                </span>
              ) : null}
            </span>
            <span className="text-[11px] text-text-muted shrink-0">
              {STATUS[row.status]}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-text-muted mt-3">{mix.caption}</p>
    </Panel>
  );
}
