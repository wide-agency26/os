"use client";

import { useActionState } from "react";
import {
  importWebStyleGuideSnapshot,
  clearWebStyleGuideHtmlSnapshotForm,
  generateWebStyleGuideFromDocument,
  type WebStyleGuideSnapshotState,
} from "@/app/actions/web-style-guide-snapshot";

const initial: WebStyleGuideSnapshotState = {};

export function WebStyleGuideImportForm({ clientId }: { clientId: string }) {
  const [importState, importAction, importPending] = useActionState(importWebStyleGuideSnapshot, initial);
  const [clearState, clearAction, clearPending] = useActionState(
    clearWebStyleGuideHtmlSnapshotForm,
    initial
  );
  const [aiState, aiAction, aiPending] = useActionState(generateWebStyleGuideFromDocument, initial);

  return (
    <div className="space-y-4">
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-text-primary">AI builder — turn any document into a style guide</p>
        <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">
          Upload <strong className="font-medium text-text-primary">any</strong> brand doc, deck, or notes (PDF / .txt /
          .md / .csv) — or just describe the brand below. The AI drafts editable, fully-styled blocks (colours, type,
          buttons, components) you can refine and save. No HTML export needed.
        </p>
      </div>
      <form action={aiAction} className="space-y-3">
        <input type="hidden" name="client_id" value={clientId} />
        {aiState.error ? <p className="text-xs text-danger">{aiState.error}</p> : null}
        {aiState.success ? <p className="text-xs text-success">{aiState.success}</p> : null}
        <label className="block">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Source document (optional)</span>
          <input
            name="source"
            type="file"
            accept=".pdf,.txt,.md,.csv,.html,.htm,application/pdf,text/plain,text/markdown"
            className="mt-1 block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-raised file:px-3 file:py-2 file:text-xs file:font-medium"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">
            Notes / brand description (optional)
          </span>
          <textarea
            name="notes"
            rows={3}
            placeholder="e.g. Fintech brand. Primary #0A84FF, dark UI, Inter font, friendly but precise voice. Need colours, type scale, buttons, forms."
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm resize-y"
          />
        </label>
        <button
          type="submit"
          disabled={aiPending}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {aiPending ? "Generating…" : "Generate with AI"}
        </button>
      </form>
    </div>

    <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-text-primary">Flowkit playbook (full page)</p>
        <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">
          Upload the exported <strong className="font-medium text-text-primary">HTML</strong> from Webflow (full page
          with <code className="text-[10px]">sg_wrapper</code>). We split it into <strong className="font-medium text-text-primary">editable blocks</strong> (sections) you can reorder, hide, and edit—same idea as Brand Hub. Scripts are stripped; linked CSS still loads.{" "}
          <strong className="font-medium text-text-primary">PDF</strong> uploads only capture text as notes (not the layout).
        </p>
      </div>

      <form action={importAction} className="space-y-3">
        <input type="hidden" name="client_id" value={clientId} />
        {importState.error ? <p className="text-xs text-danger">{importState.error}</p> : null}
        {importState.success ? <p className="text-xs text-success">{importState.success}</p> : null}
        <label className="block">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">File (.html / .htm / .pdf)</span>
          <input
            name="source"
            type="file"
            accept=".html,.htm,.pdf,text/html,application/pdf"
            required
            className="mt-1 block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-raised file:px-3 file:py-2 file:text-xs file:font-medium"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">
            Optional base URL (for relative CSS paths)
          </span>
          <input
            name="base_url"
            type="url"
            placeholder="https://your-site.webflow.io/"
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={importPending}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {importPending ? "Importing…" : "Import playbook"}
        </button>
      </form>

      <form action={clearAction} className="pt-2 border-t border-border-subtle">
        <input type="hidden" name="client_id" value={clientId} />
        {clearState.error ? <p className="text-xs text-danger mb-2">{clearState.error}</p> : null}
        {clearState.success ? <p className="text-xs text-success mb-2">{clearState.success}</p> : null}
        <button
          type="submit"
          disabled={clearPending}
          className="text-xs font-medium text-text-muted hover:text-danger underline-offset-2 hover:underline disabled:opacity-50"
        >
          Clear imported HTML (keeps PDF notes)
        </button>
      </form>
    </div>
    </div>
  );
}
