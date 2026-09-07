"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkHubRow } from "@/lib/work/load-hub";
import { WORK_GROUP_LABELS } from "@/lib/work/stages";
import { workRowHref } from "@/lib/work/navigation";
import { CompanyLogoMark } from "@/components/crm/CompanyLogo";
import { OfferingChips } from "@/components/offerings/OfferingChips";
import { DealAmountCell } from "@/components/work/DealAmountCell";
import { MONTH_SHORT } from "@/lib/accounting/types";

function formatStart(iso: string | null) {
  if (!iso || iso.length < 7) return "—";
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  if (!m || m < 1 || m > 12) return iso.slice(0, 10);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

function ClientProjectCard({ row }: { row: WorkHubRow }) {
  return (
    <Link
      href={workRowHref(row, "client")}
      className="flex flex-col rounded-lg border border-border bg-surface p-4 hover:border-text-muted transition-colors min-h-[140px]"
    >
      <div className="flex items-start gap-3">
        <CompanyLogoMark
          label={row.label}
          logoUrl={row.logoUrl}
          website={row.website}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-text-primary truncate">
            {row.projectTitle || row.label}
          </p>
          <p className="text-[12px] text-text-secondary truncate">{row.label}</p>
        </div>
      </div>
      {(row.offerings?.length ?? 0) > 0 ? (
        <div className="mt-2" onClick={(e) => e.preventDefault()}>
          <OfferingChips value={row.offerings} editable={false} compact />
        </div>
      ) : null}
      <div className="mt-auto pt-3 flex items-end justify-between gap-2">
        <div className="text-[11px] text-text-muted space-y-0.5">
          <p>Start {formatStart(row.startDate)}</p>
          {row.teamNames?.length ? (
            <p className="truncate max-w-[200px]">{row.teamNames.join(", ")}</p>
          ) : row.ownerName ? (
            <p>{row.ownerName}</p>
          ) : null}
          {row.nextAction ? (
            <p className="text-text-secondary truncate max-w-[180px]">{row.nextAction}</p>
          ) : null}
        </div>
        <DealAmountCell amount={row.dealValue} frequency={row.dealFrequency} />
      </div>
    </Link>
  );
}

export function WorkClientsGrid({ rows }: { rows: WorkHubRow[] }) {
  const live = rows.filter((r) => r.group === "live");

  if (live.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-10 text-center">
        No live client projects yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {live.map((r) => (
        <ClientProjectCard key={r.projectId || r.companyId} row={r} />
      ))}
    </div>
  );
}

export function WorkArchivedTable({
  rows,
  filter,
}: {
  rows: WorkHubRow[];
  filter?: string;
}) {
  const router = useRouter();
  let archived = rows.filter((r) => r.group === "done" || r.group === "lose");
  if (filter === "done") archived = archived.filter((r) => r.group === "done");
  if (filter === "lose") archived = archived.filter((r) => r.group === "lose");

  if (archived.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-10 text-center">Nothing archived yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-raised text-left text-[11px] uppercase tracking-wider text-text-muted">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Company / Project</th>
            <th className="px-4 py-2.5 font-semibold">Outcome</th>
            <th className="px-4 py-2.5 font-semibold">Start</th>
            <th className="px-4 py-2.5 font-semibold">€</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {archived.map((r) => (
            <tr
              key={r.projectId || `${r.companyId}-${r.group}`}
              className="cursor-pointer hover:bg-surface-raised/60"
              onClick={() => router.push(workRowHref(r, "archive"))}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <CompanyLogoMark
                    label={r.label}
                    logoUrl={r.logoUrl}
                    website={r.website}
                    size={28}
                  />
                  <div>
                    <p className="font-medium text-text-primary">
                      {r.projectTitle || r.label}
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      {r.projectTitle ? r.label : r.nextAction || "—"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-[10px] font-bold uppercase text-text-secondary">
                  {WORK_GROUP_LABELS[r.group]}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-text-secondary tabular-nums">
                {formatStart(r.startDate)}
              </td>
              <td className="px-4 py-3">
                <DealAmountCell amount={r.dealValue} frequency={r.dealFrequency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
