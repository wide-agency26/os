"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CLIENT_REQUEST_SERVICES,
  SERVICE_FIELD_CONFIG,
  type ClientRequestService,
} from "@/lib/client-requests/services";
import { submitClientRequest, type ClientRequestState } from "@/app/actions/client-requests";

const initial: ClientRequestState = {};

export function SubmitRequestModal({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState<ClientRequestService>(CLIENT_REQUEST_SERVICES[0]);
  const [state, action, pending] = useActionState(
    submitClientRequest.bind(null, clientId),
    initial
  );

  const fields = useMemo(() => SERVICE_FIELD_CONFIG[service], [service]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-start rounded-xl border border-border bg-surface-raised p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
      >
        <span className="text-sm font-semibold text-text-primary">Submit New Request</span>
        <span className="mt-1 text-xs text-text-muted">Choose a service — we&apos;ll follow up</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal
          aria-labelledby="request-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl my-8">
            <h2 id="request-modal-title" className="text-lg font-semibold text-text-primary">
              Submit a request
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Tell us what you need. Fields adjust based on the service you choose.
            </p>

            <form action={action} className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="font-medium">Service *</span>
                <select
                  name="service"
                  required
                  value={service}
                  onChange={(e) => setService(e.target.value as ClientRequestService)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  {CLIENT_REQUEST_SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {fields.map((field) => (
                <label key={field.name} className="block text-sm">
                  <span className="font-medium">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  {field.type === "textarea" ? (
                    <textarea
                      name={field.name}
                      required={field.required}
                      rows={3}
                      placeholder={field.placeholder}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                    />
                  ) : field.type === "select" ? (
                    <select
                      name={field.name}
                      required={field.required}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <option value="">— Select —</option>
                      {(field.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.name}
                      type={field.type === "url" ? "url" : "text"}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                    />
                  )}
                </label>
              ))}

              <label className="block text-sm">
                <span className="font-medium">Best date we can get back to you *</span>
                <input
                  name="preferred_response_date"
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Anything else?</span>
                <textarea
                  name="additional_notes"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="Optional context for our team"
                />
              </label>

              {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
              {state.success ? (
                <p className="text-sm text-success">{state.success}</p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  {state.success ? "Close" : "Cancel"}
                </button>
                {!state.success ? (
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {pending ? "Sending…" : "Submit request"}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
