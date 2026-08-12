"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  getDiscoveryConfig,
  logDiscoveredProspect,
  runOpportunityDiscovery,
  saveDiscoveryConfig,
  type DiscoveryRunHit,
} from "@/app/actions/opportunity-finder";
import {
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoveryConfig,
  type DiscoverySignalSource,
} from "@/lib/bd/opportunity-finder";
import { Loader2, Search, UserPlus } from "lucide-react";

const ALL_SOURCES: DiscoverySignalSource[] = [
  "funding",
  "rebrand",
  "job_posting",
  "directory",
  "rfp",
];

export function OpportunityFinderClient() {
  const [config, setConfig] = useState<DiscoveryConfig>(DEFAULT_DISCOVERY_CONFIG);
  const [hits, setHits] = useState<DiscoveryRunHit[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await getDiscoveryConfig();
      if (res.ok) setConfig(res.config);
      setLoaded(true);
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
      setHits(res.hits);
      setMessage(`Found ${res.hits.length} signal(s).`);
    });
  }

  function logHit(hit: DiscoveryRunHit) {
    startTransition(async () => {
      const res = await logDiscoveredProspect({
        signal: hit,
        warmIntros: hit.warm_intros,
      });
      if (!res.ok) {
        setMessage(res.error || "Log failed");
        return;
      }
      setMessage(`Logged prospect ${res.recordId?.slice(0, 8)}…`);
      setHits((prev) =>
        prev.map((h) =>
          h.id === hit.id ? { ...h, already_logged: true } : h
        )
      );
    });
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 py-2 max-w-4xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Opportunity Finder
        </p>
        <h1 className="text-2xl font-semibold text-gray-950">
          Warm-intro discovery
        </h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Surfaces Munich/DACH prospects from signals, then matches WIDE&apos;s
          CRM network for warm introductions. Cold outreach is never offered
          from this flow.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Config
        </h2>
        <label className="block text-xs font-medium text-gray-700 space-y-1">
          Keywords (comma-separated)
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
        <label className="block text-xs font-medium text-gray-700 space-y-1">
          Industries
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
        <label className="block text-xs font-medium text-gray-700 space-y-1">
          Geographies
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  on
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={saveCfg}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Save config
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={run}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Search size={14} />
            )}
            Run discovery
          </button>
        </div>
      </section>

      {message && (
        <p className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Results
        </h2>
        {hits.length === 0 && (
          <p className="text-sm text-gray-500">
            Run discovery to load curated DACH signals (live scrapers can plug
            into the same pipeline later).
          </p>
        )}
        {hits.map((hit) => (
          <article
            key={hit.id}
            className="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-950">
                  {hit.company_name}
                  {hit.contact_name ? ` · ${hit.contact_name}` : ""}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {hit.source}
                  {hit.role ? ` · ${hit.role}` : ""}
                  {hit.geography ? ` · ${hit.geography}` : ""}
                  {hit.industry ? ` · ${hit.industry}` : ""}
                </p>
                <p className="text-sm text-gray-700 mt-2">{hit.signal_summary}</p>
              </div>
              {hit.already_logged ? (
                <span className="text-[11px] font-semibold uppercase text-gray-500">
                  Already logged
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => logHit(hit)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  <UserPlus size={14} /> Log as prospect
                </button>
              )}
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Warm intro paths
              </p>
              {hit.warm_intros.length === 0 ? (
                <p className="text-xs text-gray-600">
                  No warm path found in CRM. You can still log as{" "}
                  <code className="text-[10px]">auto_discovered</code> — outreach
                  stays manual (no cold-send action here).
                </p>
              ) : (
                <ul className="space-y-1">
                  {hit.warm_intros.map((w) => (
                    <li key={w.contact_id} className="text-xs text-gray-800">
                      <Link
                        href={`/app/crm/${w.contact_id}`}
                        className="text-blue-700 font-medium"
                      >
                        {w.contact_name}
                      </Link>
                      {w.company_name ? ` · ${w.company_name}` : ""} —{" "}
                      <span className="text-gray-600">
                        {w.strength}: {w.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Explicitly no cold outreach CTA */}
            <p className="text-[11px] text-gray-500">
              Direct outreach from this screen is disabled by design.
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
