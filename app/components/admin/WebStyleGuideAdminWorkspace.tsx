"use client";

import { useState, useTransition } from "react";
import type { WebStyleGuideDocument } from "@/lib/web-style-guide/document";
import { WebStyleGuideDocumentEditor } from "@/app/components/admin/WebStyleGuideDocumentEditor";
import { StyleGuideDocumentFrame } from "@/app/components/web-style-guide/StyleGuideDocumentFrame";
import { FlowkitStyleGuideFrame } from "@/app/components/web-style-guide/FlowkitStyleGuideFrame";
import { saveWebStyleGuideDocument } from "@/app/actions/web-style-guide-document";

export function WebStyleGuideAdminWorkspace({
  clientId,
  clientLabel,
  initialDocument,
  legacyHtml,
  legacyBodyClass,
  legacyStylesheetHrefs,
  legacyInlineHeadStyles,
  updatedAt,
}: {
  clientId: string;
  clientLabel: string;
  initialDocument: WebStyleGuideDocument;
  legacyHtml: string;
  legacyBodyClass: string;
  legacyStylesheetHrefs: string[];
  legacyInlineHeadStyles: string;
  updatedAt: string | null;
}) {
  const [doc, setDoc] = useState<WebStyleGuideDocument>(initialDocument);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showStructuredPreview = doc.sections.filter((s) => s.visible).length > 0;
  const hasLegacyOnly = !showStructuredPreview && legacyHtml.trim().length > 0;

  function onSave() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveWebStyleGuideDocument(clientId, doc);
      if (res.error) {
        setError(res.error);
        return;
      }
      setMessage(res.success ?? "Saved.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Playbook blocks</h2>
          <p className="text-[11px] text-text-secondary mt-0.5 max-w-xl">
            Edit sections imported from HTML, toggle visibility, reorder, then save. Live preview uses your export
            stylesheets plus the blocks you keep visible.
          </p>
          {updatedAt ? (
            <p className="text-[10px] text-text-muted mt-1">
              Last import/save: {new Date(updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="shrink-0 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save blocks"}
        </button>
      </div>

      {message && !error ? (
        <div className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-3 text-xs text-text-secondary">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger">{error}</div>
      ) : null}

      {hasLegacyOnly ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-[11px] text-text-secondary">
          This client still has <strong className="text-text-primary">legacy</strong> full-page HTML only. Re-import the
          HTML file to generate editable blocks; until then the preview below uses the legacy fragment.
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,400px)_1fr] gap-6 items-start">
        <div className="rounded-2xl border border-border bg-surface p-4 max-h-[calc(100vh-10rem)] overflow-y-auto order-2 xl:order-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-3 sticky top-0 bg-surface pb-2">
            {clientLabel}
          </p>
          <WebStyleGuideDocumentEditor doc={doc} onChange={setDoc} />
        </div>

        <div className="order-1 xl:order-2 min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Live preview</p>
          {showStructuredPreview ? (
            <StyleGuideDocumentFrame doc={doc} className="w-full min-h-[70vh] rounded-2xl border border-border bg-white shadow-sm" />
          ) : hasLegacyOnly ? (
            <FlowkitStyleGuideFrame
              bodyClass={legacyBodyClass}
              fragment={legacyHtml}
              stylesheetHrefs={legacyStylesheetHrefs}
              inlineHeadStyles={legacyInlineHeadStyles}
              className="w-full min-h-[70vh] rounded-2xl border border-border bg-white shadow-sm"
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-10 text-center text-xs text-text-muted min-h-[40vh] flex items-center justify-center">
              Import HTML to build preview, or add a section.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
