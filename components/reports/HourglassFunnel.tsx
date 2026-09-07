"use client";

import { Lock } from "lucide-react";
import { formatCompact } from "@/lib/reports/ga4-website";

export interface HourglassStage {
  id: string;
  label: string;
  value: number;
  /** Actual data metric shown under the number (e.g. Impressions) */
  metricHint?: string;
  /** Extra sentence under the metric — used on the client report */
  detail?: string;
  locked?: boolean;
  lockedHint?: string;
}

interface HourglassFunnelProps {
  stages: HourglassStage[];
  className?: string;
  /** Client-facing rate copy instead of “Drop-off / conversion” jargon */
  plainLanguage?: boolean;
}

function rate(from: number, to: number): number | null {
  if (from <= 0) return null;
  return (to / from) * 100;
}

function dropoff(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((from - to) / from) * 100;
}

/**
 * Custom hourglass funnel — awareness → consideration → conversion waist,
 * then locked loyalty / advocacy blocks. No MUI dependency.
 */
export function HourglassFunnel({
  stages,
  className = "",
  plainLanguage = false,
}: HourglassFunnelProps) {
  const active = stages.filter((s) => !s.locked);
  const locked = stages.filter((s) => s.locked);
  const max = Math.max(...active.map((s) => s.value), 1);

  return (
    <div className={`space-y-0 ${className}`}>
      {active.map((stage, i) => {
        const widthPct = Math.max(28, Math.min(100, (stage.value / max) * 100));
        const next = active[i + 1];
        const conv = next ? rate(stage.value, next.value) : null;
        const drop = next ? dropoff(stage.value, next.value) : null;
        const fills = ["bg-accent", "bg-neutral-700", "bg-neutral-500"];
        const fill = fills[i % fills.length];

        return (
          <div key={stage.id} className="relative">
            <div className="flex justify-center">
              <div
                className={`relative ${fill} text-white transition-all`}
                style={{
                  width: `${widthPct}%`,
                  clipPath:
                    i === 0
                      ? "polygon(0 0, 100% 0, 92% 100%, 8% 100%)"
                      : i === active.length - 1
                        ? "polygon(8% 0, 92% 0, 78% 100%, 22% 100%)"
                        : "polygon(8% 0, 92% 0, 85% 100%, 15% 100%)",
                  borderRadius: i === 0 ? "12px 12px 0 0" : undefined,
                }}
              >
                <div className="px-4 py-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                    {i + 1}. {stage.label}
                  </p>
                  <p className="text-[26px] font-bold tabular-nums mt-1 leading-none">
                    {formatCompact(stage.value)}
                  </p>
                  {stage.metricHint && (
                    <p className="text-[11px] text-white/70 mt-1.5 leading-snug px-1">
                      {stage.metricHint}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {stage.detail && (
              <p className="text-center text-[12px] text-text-secondary leading-relaxed max-w-xl mx-auto px-4 pt-2">
                {stage.detail}
              </p>
            )}

            {next && (plainLanguage ? conv != null : drop != null || conv != null) && (
              <div className="flex justify-center py-2">
                <div className="inline-flex flex-col sm:flex-row items-center gap-2 text-[11px] px-3 py-1.5 rounded-full bg-surface-raised border border-border text-text-secondary">
                  {plainLanguage ? (
                    <span className="font-semibold tabular-nums">
                      {conv!.toFixed(1)}% moved to the next step
                      {drop != null ? ` · ${drop.toFixed(0)}% did not continue` : ""}
                    </span>
                  ) : (
                    <>
                      {drop != null && (
                        <span className="font-semibold tabular-nums">
                          Drop-off {drop.toFixed(1)}%
                        </span>
                      )}
                      {conv != null && (
                        <span className="font-semibold tabular-nums">
                          → {conv.toFixed(2)}% conversion
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {locked.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {locked.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-center"
            >
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                <Lock size={12} /> {s.label}
              </div>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                {s.lockedHint || "Coming soon — connect CRM data"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
