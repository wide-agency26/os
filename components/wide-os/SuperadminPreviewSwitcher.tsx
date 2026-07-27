"use client";

import { useEffect, useState, useTransition } from "react";
import {
  clearPreviewMode,
  setPreviewMode,
  type PreviewModeState,
} from "@/app/actions/preview-mode";
import {
  PREVIEWABLE_ROLES,
  previewOptionalClient,
  previewOptionalProspect,
  previewRequiresClient,
  previewRequiresProspect,
  previewRoleLabel,
  type PreviewContext,
  type PreviewableRole,
} from "@/lib/preview-mode";

type Option = { id: string; label: string };

export function SuperadminPreviewSwitcher({
  preview,
}: {
  preview: PreviewContext | null;
}) {
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<PreviewableRole>(preview?.role ?? "client_manager");
  const [clientId, setClientId] = useState(preview?.clientId ?? "");
  const [prospectId, setProspectId] = useState(preview?.prospectId ?? "");
  const [clients, setClients] = useState<Option[]>([]);
  const [prospects, setProspects] = useState<Option[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/preview-options");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not load preview options");
        }
        const data = await res.json();
        if (cancelled) return;
        setClients(data.clients ?? []);
        setProspects(data.prospects ?? []);
        if (!clientId && data.clients?.[0]?.id) setClientId(data.clients[0].id);
        if (!prospectId && data.prospects?.[0]?.id) setProspectId(data.prospects[0].id);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load options");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApply = (formData: FormData) => {
    startTransition(async () => {
      await setPreviewMode({} as PreviewModeState, formData);
    });
  };

  const onClear = () => {
    startTransition(async () => {
      await clearPreviewMode();
    });
  };

  return (
    <div className="mx-3 mb-3 rounded-xl border border-accent/25 bg-accent/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          View as
        </p>
        {preview ? (
          <span className="text-[10px] text-text-muted">Active</span>
        ) : null}
      </div>
      {preview ? (
        <p className="text-xs text-text-secondary">
          Previewing: <span className="text-text-primary">{previewRoleLabel(preview.role)}</span>
          {preview.clientId ? ` · client` : null}
          {preview.prospectId ? ` · prospect` : null}
        </p>
      ) : (
        <p className="text-[11px] text-text-muted leading-snug">
          Switch sidebar and routes to match another role. You stay signed in as superadmin.
        </p>
      )}
      {loadError ? <p className="text-[11px] text-danger">{loadError}</p> : null}
      <form action={onApply} className="space-y-2">
        <label className="block">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Role</span>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as PreviewableRole)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
            disabled={pending}
          >
            {PREVIEWABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {previewRoleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        {(previewRequiresClient(role) || previewOptionalClient(role)) && (
          <label className="block">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">
              {previewRequiresClient(role) ? "Client (required)" : "Client (optional)"}
            </span>
            <select
              name="client_id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
              disabled={pending || clients.length === 0}
            >
              {previewOptionalClient(role) ? <option value="">— Roster overview —</option> : null}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {(previewRequiresProspect(role) || previewOptionalProspect(role)) && (
          <label className="block">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">
              {previewRequiresProspect(role) ? "Prospect (required)" : "Prospect (optional)"}
            </span>
            <select
              name="prospect_id"
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
              disabled={pending || prospects.length === 0}
            >
              {previewOptionalProspect(role) ? (
                <option value="">— BD overview —</option>
              ) : null}
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent/15 border border-accent/30 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
        >
          {pending ? "Applying…" : preview ? "Update preview" : "Apply preview"}
        </button>
      </form>
      {preview ? (
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="w-full rounded-lg border border-border py-1.5 text-[11px] text-text-muted hover:text-text-primary disabled:opacity-50"
        >
          Exit preview → Executive
        </button>
      ) : null}
    </div>
  );
}
