"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { EmptyState, PageHeader, Panel } from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";
import type { ProposeProjectOption } from "@/lib/strategy/types";
import type { LegacyDeckRow } from "@/lib/strategy/load";

export function ProposeHub({
  projects,
  decks,
}: {
  projects: ProposeProjectOption[];
  decks: LegacyDeckRow[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.company.toLowerCase().includes(needle)
    );
  }, [projects, q]);

  const byCompany = useMemo(() => {
    const map = new Map<string, ProposeProjectOption[]>();
    for (const p of filtered) {
      const list = map.get(p.company) ?? [];
      list.push(p);
      map.set(p.company, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <Workspace>
      <PageHeader
        title="Proposal builder"
        subtitle="Pick a project, confirm the engagement scope, then create a strategy. Builder walks the analyzers; Share is the client presentation (Print / Save PDF)."
      />

      <label className="block mb-5">
        <span className="sr-only">Search companies or projects</span>
        <input
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
          placeholder="Search company or project"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {byCompany.length === 0 ? (
        <EmptyState>No projects yet. Open Work and pick a live company first.</EmptyState>
      ) : (
        <div className="space-y-6">
          {byCompany.map(([company, rows]) => (
            <div key={company}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                {company}
              </h3>
              <div className="space-y-2">
                {rows.map((p) => (
                  <Panel key={p.id} className="px-4 py-3">
                    <button
                      type="button"
                      className="w-full text-left flex items-baseline justify-between gap-3"
                      onClick={() => router.push(workPaths.proposeProject(p.id))}
                    >
                      <span className="text-[14px] font-medium text-text-primary">
                        {p.title}
                      </span>
                      <span className="text-[12px] text-text-muted shrink-0">
                        {p.stage || p.status || "open"}
                      </span>
                    </button>
                  </Panel>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {decks.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Legacy slide decks
          </h3>
          <p className="text-[12px] text-text-muted mb-3">
            Existing decks stay available. New proposals use engagement scopes, not slides.
          </p>
          <ul className="space-y-2">
            {decks.map((d) => (
              <li key={d.id}>
                <Panel className="px-4 py-3 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-text-primary">{d.title}</p>
                    <p className="text-[12px] text-text-muted">{d.status}</p>
                  </div>
                  {d.publicSlug ? (
                    <Link
                      href={`/p/${d.publicSlug}`}
                      className="text-[12px] font-medium text-blue-700"
                    >
                      Public link
                    </Link>
                  ) : (
                    <span className="text-[12px] text-text-muted">Draft</span>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Workspace>
  );
}
