"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { CompanyUsersState } from "@/app/actions/company-members";

const STORAGE_PREFIX = "wide-portal-creds:";

export function persistPortalCredentials(key: string, state: CompanyUsersState) {
  if (!key || state.error || !(state.username || state.tempPassword || state.loginUrl)) {
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
    sessionStorage.setItem(STORAGE_PREFIX + "last", key);
  } catch {
    /* private mode / quota — credentials still show in React state */
  }
}

export function loadPortalCredentials(key: string): CompanyUsersState | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompanyUsersState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function PortalCredentials({
  state,
  className,
}: {
  state: CompanyUsersState;
  className?: string;
}) {
  const rows = [
    state.username ? { label: "Username", value: state.username, hint: "Their email." } : null,
    state.tempPassword
      ? {
          label: "Temporary password",
          value: state.tempPassword,
          hint: "Shown once. They must change it on first login.",
        }
      : null,
    state.loginUrl
      ? {
          label: "Login link",
          value: state.loginUrl,
          hint: "Send this with the username and password.",
        }
      : null,
    state.portalUrl && !state.loginUrl
      ? { label: "Portal link", value: state.portalUrl, hint: "Send this once they have an account." }
      : null,
    state.inviteLink && state.inviteLink !== state.loginUrl
      ? { label: "Invite link", value: state.inviteLink }
      : null,
  ].filter(Boolean) as { label: string; value: string; hint?: string }[];

  if (!state.success && !state.error && rows.length === 0) return null;

  return (
    <div
      className={
        className ||
        `rounded-lg border px-3 py-2.5 space-y-2 ${
          state.error
            ? "border-red-200 bg-red-50"
            : "border-emerald-200 bg-emerald-50"
        }`
      }
    >
      {state.error ? (
        <p className="text-[12px] text-red-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-[12px] text-emerald-800">{state.success}</p>
      ) : null}
      {rows.map((row) => (
        <CopyRow key={row.label} label={row.label} value={row.value} hint={row.hint} />
      ))}
    </div>
  );
}

function CopyRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  return (
    <div className="rounded-md border border-gray-200 bg-white px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopyError(false);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopyError(true);
            }
          }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 hover:text-gray-900"
        >
          {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
          {copyError ? "Copy failed" : copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-gray-700 break-all mt-0.5">{value}</p>
      {hint ? <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p> : null}
    </div>
  );
}
