import Link from "next/link";
import { Panel } from "@/components/frappe-ui/primitives";

export function ConnectionNotice({
  aiConfigured,
  docsCount,
  generateNeeds,
  docsRequired = true,
  contextHref,
}: {
  aiConfigured: boolean;
  docsCount: number;
  generateNeeds?: string;
  docsRequired?: boolean;
  contextHref?: string;
}) {
  const missingAi = !aiConfigured;
  const missingDocs = docsRequired && docsCount === 0;
  if (!missingAi && !missingDocs) {
    const docsBit =
      docsCount > 0
        ? ` · ${docsCount} research doc${docsCount === 1 ? "" : "s"} on this project.`
        : docsRequired
          ? " · no research docs yet."
          : ".";
    return (
      <p className="text-[12px] text-text-muted mb-4">
        AI connected{docsBit}
      </p>
    );
  }

  return (
    <Panel className="p-4 mb-5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Before you generate
      </p>
      {missingAi ? (
        <p className="text-[13px] text-text-secondary">
          AI is not connected. Generate is blocked until Vercel AI Gateway
          is available (OIDC on production, or{" "}
          <span className="font-medium text-text-primary">vercel env pull</span> locally).{" "}
          <Link href="/app/settings/connections" className="font-medium text-blue-700">
            Open Connections →
          </Link>
        </p>
      ) : null}
      {missingDocs ? (
        <p className="text-[13px] text-text-secondary">
          No research documents on this project yet.{" "}
          {contextHref ? (
            <>
              Upload them on Context first.{" "}
              <Link href={contextHref} className="font-medium text-blue-700">
                Open Context →
              </Link>
            </>
          ) : (
            "Upload them here, or tick unverified if you must proceed without sources."
          )}
        </p>
      ) : null}
      {generateNeeds ? (
        <p className="text-[12px] text-text-muted">{generateNeeds}</p>
      ) : null}
    </Panel>
  );
}
