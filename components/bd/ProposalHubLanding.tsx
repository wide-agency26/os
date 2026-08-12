"use client";

import Link from "next/link";
import { FileText, Presentation } from "lucide-react";
import { Workspace } from "@/components/frappe-ui/Workspace";

export function ProposalHubLanding({
  bdRecordId,
}: {
  bdRecordId?: string | null;
}) {
  const q = bdRecordId ? `?bd=${encodeURIComponent(bdRecordId)}` : "";

  return (
    <Workspace wide>
      <div className="space-y-8 py-2 max-w-4xl">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Business Development
          </p>
          <h1 className="text-2xl font-semibold text-gray-950 tracking-tight">
            Proposal Builder
          </h1>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">
            Choose how you want to assemble the client proposal. Both paths write
            to the same <code className="text-xs">proposal</code> object on the BD
            record.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href={`/app/bd/lms${q}`}
            className="rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-400 transition-colors space-y-3"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-800">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-950">
                Use SOW Builder
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Full scope document with services, pricing, portfolio, and terms.
                Existing builder — unchanged internally.
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-700">
              Open SOW Builder →
            </span>
          </Link>

          <Link
            href={`/app/bd/proposal/slides/new${q}`}
            className="rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-400 transition-colors space-y-3"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-800">
              <Presentation size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-950">
                Use Slide Builder
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Auto-templated client deck from selected services, discovery
                context, and portfolio case studies.
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-700">
              Open Slide Builder →
            </span>
          </Link>
        </div>
      </div>
    </Workspace>
  );
}
