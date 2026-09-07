"use client";

import {
  clientVisibleItems,
  clientVisibleStats,
  formatPeriodLabel,
  PROGRESS_ITEM_STATUS_LABEL,
  PROGRESS_ITEM_TYPE_LABEL,
  relativeUpdated,
  type ProjectProgress,
} from "@/lib/client/progress";

const EMPTY_SENTENCE = "WIDE will publish progress here.";

export function ClientProgressView({
  progress,
  empty,
  publisherName,
  compact,
}: {
  progress: ProjectProgress | null;
  empty?: boolean;
  publisherName?: string | null;
  compact?: boolean;
}) {
  const showEmpty =
    empty || !progress || !progress.show_on_client || !progress.published_at;

  if (showEmpty || !progress) {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-dashed border-border bg-surface-raised/40 px-5 py-8 text-center"
            : "rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center"
        }
      >
        <p className="text-[14px] text-text-secondary">{EMPTY_SENTENCE}</p>
      </div>
    );
  }

  const stats = clientVisibleStats(progress.stats);
  const items = clientVisibleItems(progress.items);
  const meta = relativeUpdated(progress.published_at);

  return (
    <div className={compact ? "space-y-5" : "space-y-8"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {formatPeriodLabel(progress)}
          </p>
          <p className="text-[12px] text-text-muted mt-1">
            {meta}
            {publisherName ? ` · ${publisherName}` : ""}
          </p>
        </div>
      </div>

      {stats.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.key}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <p className="text-[11px] text-text-muted leading-snug">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
                {s.count}
              </p>
              {s.note?.trim() ? (
                <p className="mt-1 text-[11px] text-text-secondary line-clamp-2">
                  {s.note}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {progress.summary.trim() ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">
            Summary
          </p>
          <p className="text-[14px] text-text-primary whitespace-pre-wrap leading-relaxed">
            {progress.summary.trim()}
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-3">
            Deliverables
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <div className="min-w-0">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium text-text-primary hover:underline truncate block"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <p className="text-[13px] font-medium text-text-primary truncate">
                      {item.title}
                    </p>
                  )}
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {PROGRESS_ITEM_TYPE_LABEL[item.type]}
                    {item.date ? ` · ${item.date}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-surface-raised px-2 py-0.5 text-[11px] text-text-secondary">
                  {PROGRESS_ITEM_STATUS_LABEL[item.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
