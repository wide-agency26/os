"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { startSeoRun } from "@/app/actions/seo-run";
import { DEFAULT_RUN_OPTIONS } from "@/lib/seo/constants";
import { Card, SectionLabel } from "./primitives";

export function RunLauncher({ initialUrl = "" }: { initialUrl?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [maxPages, setMaxPages] = useState(DEFAULT_RUN_OPTIONS.maxPages);
  const [competitors, setCompetitors] = useState("");
  const [gscProperty, setGscProperty] = useState("");
  const [includePerformance, setIncludePerformance] = useState(true);
  const [includeQuestions, setIncludeQuestions] = useState(true);
  const [includeSearchData, setIncludeSearchData] = useState(true);
  const [includeAi, setIncludeAi] = useState(true);

  function submit() {
    setError(null);
    if (!url.trim()) {
      setError("Enter a website address to audit.");
      return;
    }

    startTransition(async () => {
      const competitorList = competitors
        .split(/[\n,]/)
        .map((c) => c.trim())
        .filter(Boolean);

      const result = await startSeoRun({
        url,
        gscProperty: gscProperty.trim() || null,
        options: {
          maxPages,
          competitors: competitorList,
          includePerformance,
          includeQuestions,
          includeSearchData,
          includeAi,
          includeCompetitors: competitorList.length > 0,
        },
      });

      if (!result.ok || !result.runId) {
        setError(result.error ?? "Could not start the audit.");
        return;
      }
      router.push(`/app/seo/${result.runId}`);
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900">Run a full SEO audit</h2>
        <p className="mt-1 text-[13px] text-gray-600">
          Enter a website address. We crawl the site, check it against current ranking
          factors, measure real page speed, find the questions people actually search for,
          and produce a prioritised plan.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !pending) submit();
            }}
            placeholder="example.com"
            disabled={pending}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 text-[14px] outline-none transition-colors focus:border-gray-400 disabled:bg-gray-50"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : null}
          {pending ? "Starting…" : "Run full audit"}
        </button>
      </div>

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`}
          />
          Advanced options
        </button>

        {advancedOpen ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <SectionLabel>Page limit</SectionLabel>
              <input
                type="number"
                min={1}
                max={2000}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value) || 100)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-gray-400"
              />
              <p className="text-[11px] text-gray-500">
                How many pages to crawl. Larger sites take longer; the audit runs in the
                background either way.
              </p>
            </div>

            <div className="space-y-1.5">
              <SectionLabel>Search Console property</SectionLabel>
              <input
                value={gscProperty}
                onChange={(e) => setGscProperty(e.target.value)}
                placeholder="sc-domain:example.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-gray-400"
              />
              <p className="text-[11px] text-gray-500">
                Optional. Requires a connected Google account with access to the property.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <SectionLabel>Competitors</SectionLabel>
              <textarea
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                rows={2}
                placeholder="competitor-one.com, competitor-two.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-gray-400"
              />
              <p className="text-[11px] text-gray-500">
                Up to five domains, comma or line separated. Each is crawled at reduced
                depth and compared against your site.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <SectionLabel>Phases to include</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle
                  label="Page speed (PageSpeed Insights)"
                  checked={includePerformance}
                  onChange={setIncludePerformance}
                />
                <Toggle
                  label="Question and topic mining"
                  checked={includeQuestions}
                  onChange={setIncludeQuestions}
                />
                <Toggle
                  label="Search Console data"
                  checked={includeSearchData}
                  onChange={setIncludeSearchData}
                />
                <Toggle
                  label="AI summary and roadmap"
                  checked={includeAi}
                  onChange={setIncludeAi}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900"
      />
      <span className="text-[12px] text-gray-700">{label}</span>
    </label>
  );
}
