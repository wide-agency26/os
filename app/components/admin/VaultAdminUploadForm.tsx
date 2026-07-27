"use client";

import { useActionState } from "react";
import { adminUploadVaultFile, type VaultUploadState } from "@/app/actions/vault-admin";

const initial: VaultUploadState = {};

const CATEGORIES = [
  "Strategy",
  "Wireframes",
  "Final assets",
  "Legal / contracts",
  "Invoices",
  "General",
];

export function VaultAdminUploadForm({
  clientId,
  currentFiles,
}: {
  clientId: string;
  currentFiles: { id: string; label: string; version: number }[];
}) {
  const [state, formAction, pending] = useActionState(adminUploadVaultFile, initial);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-xs font-semibold text-text-primary">Upload deliverable</p>
      {state.error ? (
        <p className="text-xs text-danger">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-xs text-success">{state.success}</p>
      ) : null}
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Label</span>
        <input
          name="label"
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Q3 brand deck"
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Category</span>
        <select
          name="category"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          New version of (optional)
        </span>
        <select name="replace_file_id" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <option value="">— New file —</option>
          {currentFiles.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} (v{f.version})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">File</span>
        <input
          name="file"
          type="file"
          required
          className="mt-1 w-full text-sm text-text-secondary"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
