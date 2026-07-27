"use client";

import { useActionState } from "react";
import { upsertStyleGuideItem, type StyleGuideState } from "@/app/actions/style-guide";

const initial: StyleGuideState = {};

export function StyleGuideItemForm({
  clientId,
  item,
}: {
  clientId: string;
  item?: {
    id: string;
    title: string;
    component_kind: string;
    staging_url: string | null;
    why_notes: string | null;
    dos: string | null;
    donts: string | null;
    sort_order: number;
  };
}) {
  const [state, formAction, pending] = useActionState(upsertStyleGuideItem, initial);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-4 space-y-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-xs font-semibold text-text-primary">
        {item ? "Edit component" : "Add web component"}
      </p>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-success">{state.success}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Title</span>
          <input
            name="title"
            required
            defaultValue={item?.title}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
            placeholder="Primary navigation"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Kind</span>
          <input
            name="component_kind"
            defaultValue={item?.component_kind ?? "navigation"}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Sort</span>
          <input
            name="sort_order"
            type="number"
            defaultValue={item?.sort_order ?? 0}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Staging / preview URL</span>
        <input
          name="staging_url"
          defaultValue={item?.staging_url ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          placeholder="https://…"
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Screenshot (optional)</span>
        <input name="screenshot" type="file" accept="image/*" className="mt-1 w-full text-sm" />
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Why we did this</span>
        <textarea
          name="why_notes"
          rows={3}
          defaultValue={item?.why_notes ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Do&apos;s</span>
        <textarea
          name="dos"
          rows={2}
          defaultValue={item?.dos ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Don&apos;ts</span>
        <textarea
          name="donts"
          rows={2}
          defaultValue={item?.donts ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : item ? "Update" : "Add item"}
      </button>
    </form>
  );
}
