"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { ClientProgressView } from "@/components/client/ClientProgressView";
import { publishProjectProgress } from "@/app/actions/project-progress";
import {
  emptyProjectProgress,
  newProgressItemId,
  periodBoundsFor,
  relativeUpdated,
  type ProgressItem,
  type ProgressItemStatus,
  type ProgressItemType,
  type ProgressPeriodKind,
  type ProgressStat,
  type ProjectProgress,
  PROGRESS_ITEM_STATUS_LABEL,
  PROGRESS_ITEM_TYPE_LABEL,
} from "@/lib/client/progress";
import { ClientVisibleToggle } from "@/components/client/ClientVisibleToggle";

const ITEM_TYPES = Object.keys(PROGRESS_ITEM_TYPE_LABEL) as ProgressItemType[];
const ITEM_STATUSES = Object.keys(PROGRESS_ITEM_STATUS_LABEL) as ProgressItemStatus[];

export function ProjectProgressEditor({
  projectId,
  initial,
  initialPublisherName,
}: {
  projectId: string;
  initial?: ProjectProgress | null;
  initialPublisherName?: string | null;
}) {
  const [draft, setDraft] = useState<ProjectProgress>(
    () => initial || emptyProjectProgress(projectId)
  );
  const [publisherName, setPublisherName] = useState(initialPublisherName ?? null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setPeriod(kind: ProgressPeriodKind) {
    const bounds =
      kind === "custom"
        ? { period_start: draft.period_start, period_end: draft.period_end }
        : periodBoundsFor(kind);
    setDraft((d) => ({
      ...d,
      period: kind,
      period_start: bounds.period_start,
      period_end: bounds.period_end,
    }));
  }

  function updateStat(key: ProgressStat["key"], patch: Partial<ProgressStat>) {
    setDraft((d) => ({
      ...d,
      stats: d.stats.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }));
  }

  function updateItem(id: string, patch: Partial<ProgressItem>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }

  function addItem() {
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          id: newProgressItemId(),
          type: "other" as const,
          title: "",
          status: "in_build" as const,
        },
      ],
    }));
  }

  function removeItem(id: string) {
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  }

  function moveItem(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const idx = d.items.findIndex((it) => it.id === id);
      if (idx < 0) return d;
      const j = idx + dir;
      if (j < 0 || j >= d.items.length) return d;
      const next = [...d.items];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...d, items: next };
    });
  }

  async function savePublish() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await publishProjectProgress(projectId, draft);
      if (!res.ok) {
        setMsg(res.error || "Could not publish progress");
        return;
      }
      if (res.progress) setDraft(res.progress);
      setPublisherName(res.publisherName ?? null);
      setMsg("Progress published to the client portal.");
    } finally {
      setSaving(false);
    }
  }

  const previewProgress: ProjectProgress = {
    ...draft,
    published_at: draft.published_at || new Date().toISOString(),
    show_on_client: true,
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-text-primary">Client progress</p>
          <p className="text-[12px] text-text-muted mt-0.5">
            Hand-fed snapshot. Clients only see what you Save &amp; publish.
          </p>
          <p className="text-[11px] text-text-muted mt-2">Show on client portal</p>
        </div>
        <ClientVisibleToggle
          visible={draft.show_on_client}
          disabled={saving}
          onChange={(next) => setDraft((d) => ({ ...d, show_on_client: next }))}
        />
      </div>

      <div>
        <p className="text-[12px] font-medium text-text-secondary mb-2">Period</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["month", "This month"],
              ["last_month", "Last month"],
              ["custom", "Custom"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              disabled={saving}
              onClick={() => setPeriod(kind)}
              className={`rounded-lg px-3 py-1.5 text-[12px] border ${
                draft.period === kind
                  ? "border-text-primary bg-surface-raised text-text-primary"
                  : "border-border text-text-secondary hover:bg-surface-raised"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {draft.period === "custom" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="date"
              className="rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-[12px]"
              value={draft.period_start}
              disabled={saving}
              onChange={(e) =>
                setDraft((d) => ({ ...d, period_start: e.target.value }))
              }
            />
            <span className="text-[12px] text-text-muted self-center">→</span>
            <input
              type="date"
              className="rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-[12px]"
              value={draft.period_end}
              disabled={saving}
              onChange={(e) =>
                setDraft((d) => ({ ...d, period_end: e.target.value }))
              }
            />
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-text-muted">
            {draft.period_start} → {draft.period_end}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-[12px] font-medium text-text-secondary">Stats</p>
        {draft.stats.map((s) => (
          <div
            key={s.key}
            className="grid grid-cols-1 sm:grid-cols-[1fr_88px_1fr] gap-2 items-start"
          >
            <input
              className="rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[13px]"
              value={s.label}
              disabled={saving}
              onChange={(e) => updateStat(s.key, { label: e.target.value })}
            />
            <input
              type="number"
              min={0}
              className="rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[13px] tabular-nums"
              value={s.count}
              disabled={saving}
              onChange={(e) =>
                updateStat(s.key, { count: Math.max(0, Number(e.target.value) || 0) })
              }
            />
            <input
              className="rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[13px]"
              placeholder="Optional note"
              value={s.note || ""}
              disabled={saving}
              onChange={(e) => updateStat(s.key, { note: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div>
        <p className="text-[12px] font-medium text-text-secondary mb-2">Summary</p>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-[13px] leading-relaxed"
          placeholder="Short plain-language update for the client…"
          value={draft.summary}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-text-secondary">
            Deliverables
          </p>
          <button
            type="button"
            disabled={saving || draft.items.length >= 12}
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[12px] text-text-secondary hover:bg-surface-raised disabled:opacity-50"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        {draft.items.length === 0 ? (
          <p className="text-[12px] text-text-muted">No deliverables yet.</p>
        ) : (
          <ul className="space-y-2">
            {draft.items.map((it, idx) => (
              <li
                key={it.id}
                className="rounded-lg border border-border bg-surface-raised/50 p-2.5 space-y-2"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                    disabled={saving || idx === 0}
                    onClick={() => moveItem(it.id, -1)}
                    aria-label="Move up"
                  >
                    <GripVertical size={14} />
                  </button>
                  <input
                    className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-[13px]"
                    placeholder="Title"
                    value={it.title}
                    disabled={saving}
                    onChange={(e) => updateItem(it.id, { title: e.target.value })}
                  />
                  <button
                    type="button"
                    className="p-1.5 text-text-muted hover:text-red-600"
                    disabled={saving}
                    onClick={() => removeItem(it.id)}
                    aria-label="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <select
                    className="rounded-md border border-border bg-surface px-2 py-1 text-[12px]"
                    value={it.type}
                    disabled={saving}
                    onChange={(e) =>
                      updateItem(it.id, { type: e.target.value as ProgressItemType })
                    }
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PROGRESS_ITEM_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-border bg-surface px-2 py-1 text-[12px]"
                    value={it.status}
                    disabled={saving}
                    onChange={(e) =>
                      updateItem(it.id, {
                        status: e.target.value as ProgressItemStatus,
                      })
                    }
                  >
                    {ITEM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {PROGRESS_ITEM_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    className="rounded-md border border-border bg-surface px-2 py-1 text-[12px]"
                    placeholder="URL"
                    value={it.url || ""}
                    disabled={saving}
                    onChange={(e) =>
                      updateItem(it.id, { url: e.target.value || undefined })
                    }
                  />
                  <input
                    type="date"
                    className="rounded-md border border-border bg-surface px-2 py-1 text-[12px]"
                    value={it.date || ""}
                    disabled={saving}
                    onChange={(e) =>
                      updateItem(it.id, { date: e.target.value || undefined })
                    }
                  />
                </div>
                {idx > 0 ? (
                  <button
                    type="button"
                    className="text-[11px] text-text-muted hover:text-text-primary"
                    disabled={saving}
                    onClick={() => moveItem(it.id, -1)}
                  >
                    Move up
                  </button>
                ) : null}{" "}
                {idx < draft.items.length - 1 ? (
                  <button
                    type="button"
                    className="text-[11px] text-text-muted hover:text-text-primary"
                    disabled={saving}
                    onClick={() => moveItem(it.id, 1)}
                  >
                    Move down
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface-raised/30 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-3">
          Preview
        </p>
        <ClientProgressView
          progress={
            draft.show_on_client
              ? previewProgress
              : { ...previewProgress, show_on_client: false, published_at: null }
          }
          empty={!draft.show_on_client}
          publisherName={publisherName}
          compact
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[12px] text-text-muted">
          {draft.published_at
            ? `${relativeUpdated(draft.published_at)}${
                publisherName ? ` · ${publisherName}` : ""
              }`
            : "Not published yet"}
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={() => void savePublish()}
          className="inline-flex items-center gap-2 rounded-lg bg-text-primary text-white px-3.5 py-2 text-[13px] font-medium disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save &amp; publish
        </button>
      </div>
      {msg ? <p className="text-[12px] text-text-muted">{msg}</p> : null}
    </section>
  );
}
