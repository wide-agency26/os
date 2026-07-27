"use client";

import { useActionState } from "react";
import { adminAddVaultExternalLink, type VaultUploadState } from "@/app/actions/vault-admin";

const initial: VaultUploadState = {};

const CATEGORIES = [
  "Strategy",
  "Wireframes",
  "Final assets",
  "Legal / contracts",
  "Invoices",
  "General",
];

export function VaultAdminLinkForm({
  clientId,
  currentFiles,
}: {
  clientId: string;
  currentFiles: { id: string; label: string; version: number }[];
}) {
  const [state, formAction, pending] = useActionState(adminAddVaultExternalLink, initial);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-xs font-semibold text-text-primary">Google Drive / Workspace link</p>
      <p className="text-[11px] text-text-secondary leading-snug">
        Paste a share link — no Supabase upload. Clients open it in Google (respect your Drive sharing
        settings).
      </p>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-success">{state.success}</p> : null}
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Label</span>
        <input
          name="label"
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Client folder — Final deliverables"
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">HTTPS link</span>
        <input
          name="external_url"
          type="url"
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-[13px]"
          placeholder="https://drive.google.com/drive/folders/..."
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          Row subtitle (optional)
        </span>
        <input
          name="link_display_name"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Shared folder · Editor access"
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
        <select
          name="replace_file_id"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">— New row —</option>
          {currentFiles.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} (v{f.version})
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 rounded-lg border border-accent/40 bg-accent/10 text-accent text-sm font-medium hover:bg-accent/15 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save link"}
      </button>
    </form>
  );
}
