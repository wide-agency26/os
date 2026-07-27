"use client";

import { useActionState } from "react";
import { saveNotificationPreferences, type PrefsState } from "@/app/actions/preferences";

const initial: PrefsState = {};

export function NotificationPreferencesForm({
  notifyEmail,
  notifySms,
  notifyInApp,
}: {
  notifyEmail: boolean;
  notifySms: boolean;
  notifyInApp: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveNotificationPreferences, initial);

  return (
    <form action={formAction} className="rounded-2xl border border-border bg-surface p-6 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Notification preferences</h2>
      <p className="text-xs text-text-secondary">
        Choose how you want to hear about portal updates. (SMS requires carrier support in a future release —
        we store your preference now.)
      </p>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-success">{state.success}</p> : null}
      <label className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          name="notify_email"
          defaultChecked={notifyEmail}
          className="rounded border-border"
        />
        Email
      </label>
      <label className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer">
        <input type="checkbox" name="notify_sms" defaultChecked={notifySms} className="rounded border-border" />
        SMS
      </label>
      <label className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          name="notify_in_app"
          defaultChecked={notifyInApp}
          className="rounded border-border"
        />
        In-app
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-sm font-medium hover:border-accent/40 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
