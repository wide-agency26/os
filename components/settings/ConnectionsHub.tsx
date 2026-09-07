"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  INTEGRATION_GROUPS,
  INTEGRATIONS,
} from "@/lib/integrations/catalog";
import type { HubStatus, IntegrationStatus } from "@/lib/integrations/status";

const STATUS_LABEL: Record<HubStatus, string> = {
  connected: "Connected",
  ready: "Keys set · connect",
  needs_keys: "Needs keys",
  planned: "Not wired",
  internal: "Internal",
};

const STATUS_CLASS: Record<HubStatus, string> = {
  connected: "bg-emerald-50 text-emerald-800",
  ready: "bg-surface-raised text-text-primary",
  needs_keys: "bg-red-50 text-danger",
  planned: "bg-surface-raised text-text-muted",
  internal: "bg-surface-raised text-text-secondary",
};

export function ConnectionsHub({ items }: { items: IntegrationStatus[] }) {
  const [query, setQuery] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const counts = useMemo(() => {
    const c = { connected: 0, ready: 0, needs_keys: 0, planned: 0, internal: 0 };
    for (const i of items) c[i.status] += 1;
    return c;
  }, [items]);

  const q = query.trim().toLowerCase();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 text-[12px]">
        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800">
          {counts.connected} connected
        </span>
        <span className="px-2.5 py-1 rounded-md bg-red-50 text-danger">
          {counts.needs_keys} missing keys
        </span>
        <span className="px-2.5 py-1 rounded-md bg-surface-raised text-text-primary">
          {counts.ready} ready to connect
        </span>
        <span className="px-2.5 py-1 rounded-md bg-surface-raised text-text-muted">
          {counts.planned} not wired yet
        </span>
      </div>

      <p className="text-[13px] text-text-secondary max-w-2xl">
        Secrets stay in Vercel → Project → Settings → Environment Variables. This
        page only shows whether a name is set, plus how many OAuth accounts are
        bound. Nothing here can reveal a key.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key, or module…"
          className="w-full max-w-md border border-border rounded-lg px-3 py-2 text-[13px] bg-surface outline-none focus:ring-1 focus:ring-accent"
        />
        <label className="flex items-center gap-2 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            checked={onlyGaps}
            onChange={(e) => setOnlyGaps(e.target.checked)}
          />
          Gaps only
        </label>
      </div>

      {INTEGRATION_GROUPS.map((group) => {
        const defs = INTEGRATIONS.filter((d) => {
          if (d.group !== group.id) return false;
          const st = byId.get(d.id);
          if (onlyGaps && st && (st.status === "connected" || st.status === "internal")) {
            return false;
          }
          if (!q) return true;
          const blob = [
            d.name,
            d.summary,
            d.how,
            ...d.usedBy,
            ...d.keys.map((k) => k.name),
          ]
            .join(" ")
            .toLowerCase();
          return blob.includes(q);
        });
        if (!defs.length) return null;
        return (
          <section key={group.id}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {group.label}
            </h2>
            <p className="text-[12px] text-text-secondary mt-1 mb-3 max-w-3xl">
              {group.blurb}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {defs.map((def) => {
                const st = byId.get(def.id);
                if (!st) return null;
                return (
                  <article
                    key={def.id}
                    className="border border-border rounded-lg bg-surface p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[14px] font-semibold text-text-primary">
                        {def.name}
                      </h3>
                      <span
                        className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${STATUS_CLASS[st.status]}`}
                      >
                        {STATUS_LABEL[st.status]}
                      </span>
                    </div>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      {def.summary}
                    </p>
                    <p className="text-[12px] text-text-muted">
                      Used in {def.usedBy.join(" · ")}
                    </p>
                    <p className="text-[12px] text-text-secondary">{def.how}</p>
                    {def.keys.length ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {def.keys.map((k) => {
                          const presence = st.keys.find((x) => x.name === k.name);
                          const on = Boolean(presence?.set);
                          const covered = Boolean(presence?.covered);
                          const ok = on || (k.anyOf && covered);
                          return (
                            <li
                              key={k.name}
                              title={k.note || k.name}
                              className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md border ${
                                ok
                                  ? "border-emerald-200 text-emerald-800 bg-emerald-50"
                                  : k.required
                                    ? "border-red-200 text-danger bg-red-50"
                                    : "border-border text-text-muted"
                              }`}
                            >
                              {k.name}
                              <span className="ml-1 font-sans">
                                {on ? "set" : covered ? "via alt" : k.required ? "missing" : "optional"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-text-muted">No vendor key.</p>
                    )}
                    {st.hint ? (
                      <p className="text-[12px] text-text-secondary">{st.hint}</p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-3 pt-1">
                      {def.connectHref && st.status !== "planned" && st.status !== "needs_keys" ? (
                        <a
                          href={def.connectHref}
                          className="text-[12px] font-semibold text-text-primary hover:underline"
                        >
                          Connect
                        </a>
                      ) : null}
                      {def.buriedHref ? (
                        <Link
                          href={def.buriedHref}
                          className="text-[12px] text-text-secondary hover:underline"
                        >
                          {def.buriedLabel || "Open"}
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
