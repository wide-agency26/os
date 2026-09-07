"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  getDealFinderQueue,
  getDiscoveryConfig,
  runOpportunityDiscovery,
  saveDiscoveryConfig,
  type DiscoveredDealRow,
} from "@/app/actions/opportunity-finder";
import {
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoveryConfig,
  type DiscoverySignalSource,
} from "@/lib/bd/opportunity-finder";
import { DealReviewCard } from "@/components/bd/DealReviewCard";
import { Button, PageHeader, Panel } from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";

const ALL_SOURCES: DiscoverySignalSource[] = [
  "funding",
  "rebrand",
  "job_posting",
  "directory",
  "rfp",
];

function formatRun(iso: string | null) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function OpportunityFinderClient() {
  const [config, setConfig] = useState<DiscoveryConfig>(DEFAULT_DISCOVERY_CONFIG);
  const [pendingDeals, setPendingDeals] = useState<DiscoveredDealRow[]>([]);
  const [history, setHistory] = useState<DiscoveredDealRow[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refreshQueue() {
    const last = await getDealFinderQueue();
    if (!last.ok) {
      setLoadError(last.error || "Deal Finder queue failed to load");
      return;
    }
    setLoadError(null);
    setPendingDeals(last.pending);
    setHistory(last.deals.filter((d) => d.status !== "pending"));
    setLastRunAt(last.lastRunAt);
    setLastSummary(last.lastSummary);
  }

  useEffect(() => {
    void (async () => {
      try {
        const [cfg, last] = await Promise.all([
          getDiscoveryConfig(),
          getDealFinderQueue(),
        ]);
        if (cfg.ok) setConfig(cfg.config);
        if (last.ok) {
          setPendingDeals(last.pending);
          setHistory(last.deals.filter((d) => d.status !== "pending"));
          setLastRunAt(last.lastRunAt);
          setLastSummary(last.lastSummary);
        } else {
          setLoadError(last.error || cfg.error || "Deal Finder failed to load");
        }
        if (!cfg.ok && cfg.error) {
          setLoadError((prev) => prev || cfg.error || null);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Deal Finder failed to load");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function saveCfg() {
    setMessage(null);
    startTransition(async () => {
      const res = await saveDiscoveryConfig(config);
      setMessage(res.ok ? "Config saved." : res.error || "Save failed");
    });
  }

  function run() {
    setMessage(null);
    startTransition(async () => {
      const res = await runOpportunityDiscovery();
      if (!res.ok) {
        setMessage(res.error || "Run failed");
        return;
      }
      await refreshQueue();
      setMessage(
        res.newCount
          ? `${res.newCount} new prospect${res.newCount === 1 ? "" : "s"} to review.`
          : `No new prospects (${res.feedCount} feeds, ${res.skippedCount} already known).`
      );
    });
  }

  if (!loaded) {
    return <p className="text-[13px] text-text-secondary py-12">Loading Deal Finder…</p>;
  }

  const reviewed = history.slice(0, 12);

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Deal Finder"
        subtitle="Runs every morning. Review here or on Home — Approve (after edits) sends the company into Qualify as a prospect. Nothing is logged until you approve."
      />

      <Panel className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-text-muted">Last run {formatRun(lastRunAt)}</p>
          <p className="text-[13px] text-text-secondary mt-0.5">
            {lastSummary || "Waiting for the first daily run."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={workPaths.hub + "?filter=qualify"}
            className="text-[13px] font-medium text-blue-700"
          >
            Qualify →
          </Link>
          <Button disabled={pending} onClick={run}>
            {pending ? "Running…" : "Run now"}
          </Button>
        </div>
      </Panel>

      {loadError ? (
        <p className="text-[13px] text-red-600">{loadError}</p>
      ) : null}

      {message ? (
        <p className="text-[13px] text-text-secondary">{message}</p>
      ) : null}

      <section id="deal-finder">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
          Waiting for review
          {pendingDeals.length ? ` · ${pendingDeals.length}` : ""}
        </h2>
        {pendingDeals.length === 0 ? (
          <Panel className="px-4 py-6">
            <p className="text-[13px] text-text-secondary">
              Nothing waiting. The morning run will post new names here and on Home.
            </p>
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            {pendingDeals.map((deal, i) => (
              <div key={deal.id} className={i === 0 ? "" : "border-t border-border"}>
                <DealReviewCard deal={deal} onDone={() => void refreshQueue()} />
              </div>
            ))}
          </Panel>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          What to look for
        </h2>
        <label className="block text-[12px] text-text-secondary">
          Keywords
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
            value={config.keywords.join(", ")}
            onChange={(e) =>
              setConfig({
                ...config,
                keywords: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label className="block text-[12px] text-text-secondary">
          Industries
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
            value={config.industries.join(", ")}
            onChange={(e) =>
              setConfig({
                ...config,
                industries: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label className="block text-[12px] text-text-secondary">
          Geographies
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
            value={config.geographies.join(", ")}
            onChange={(e) =>
              setConfig({
                ...config,
                geographies: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_SOURCES.map((s) => {
            const on = config.sources.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    sources: on
                      ? config.sources.filter((x) => x !== s)
                      : [...config.sources, s],
                  })
                }
                className={`rounded-md border px-3 py-1.5 text-[12px] font-medium ${
                  on
                    ? "border-text-primary bg-text-primary text-white"
                    : "border-border text-text-secondary"
                }`}
              >
                {s.replaceAll("_", " ")}
              </button>
            );
          })}
        </div>
        <Button variant="secondary" disabled={pending} onClick={saveCfg}>
          Save filters
        </Button>
      </section>

      {reviewed.length ? (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
            Recently reviewed
          </h2>
          <ul className="space-y-1">
            {reviewed.map((d) => (
              <li key={d.id} className="text-[13px] text-text-secondary">
                <span className="font-medium text-text-primary">{d.companyName}</span>
                {" · "}
                {d.status}
                {d.bdRecordId ? (
                  <>
                    {" · "}
                    <Link
                      href={workPaths.qualifyId(d.bdRecordId)}
                      className="font-medium text-blue-700"
                    >
                      Open in Qualify
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
