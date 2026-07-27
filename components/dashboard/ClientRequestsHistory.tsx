import type { ClientRequestRow } from "@/app/actions/client-requests";

const STATUS_LABEL: Record<string, string> = {
  open: "Received",
  in_progress: "In progress",
  closed: "Closed",
};

export function ClientRequestsHistory({ requests }: { requests: ClientRequestRow[] }) {
  if (requests.length === 0) return null;

  return (
    <section className="mb-8">
      <h3 className="mb-4 text-sm font-medium text-text-primary">Your requests</h3>
      <ul className="space-y-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-border bg-surface p-4 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-text-primary">{r.service ?? r.subject}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
            {r.preferred_response_date ? (
              <p className="mt-1 text-xs text-text-muted">
                Preferred response:{" "}
                {new Date(r.preferred_response_date).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-text-secondary whitespace-pre-wrap line-clamp-4">
              {r.body}
            </p>
            {r.response_note ? (
              <div className="mt-3 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                  WIDE team
                </p>
                <p className="mt-1 text-xs text-text-primary">{r.response_note}</p>
                {r.responded_at ? (
                  <p className="mt-1 text-[10px] text-text-muted">
                    {new Date(r.responded_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="mt-2 text-[10px] text-text-muted">
              Submitted {new Date(r.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
