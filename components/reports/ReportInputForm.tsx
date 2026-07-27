"use client";

import { useState, useCallback } from "react";
import type { PackageTier, ReportInputPayload } from "@/lib/reports/report-types";
import { PACKAGE_LABELS } from "@/lib/reports/report-types";

type Props = {
  clientId: string;
  initialTier?: PackageTier;
  onCreated?: (reportId: string) => void;
};

export function ReportInputForm({ clientId, initialTier = "launch", onCreated }: Props) {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [tier, setTier] = useState<PackageTier>(initialTier);
  const [emailLogs, setEmailLogs] = useState("");
  const [metaAdsJson, setMetaAdsJson] = useState("");
  const [googleAdsJson, setGoogleAdsJson] = useState("");
  const [ga4Json, setGa4Json] = useState("");
  const [gscJson, setGscJson] = useState("");
  const [assetsJson, setAssetsJson] = useState("");
  const [socialJson, setSocialJson] = useState("");
  const [videoJson, setVideoJson] = useState("");
  const [crmJson, setCrmJson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeParse = useCallback((json: string) => {
    if (!json.trim()) return undefined;
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!periodStart || !periodEnd) {
        setError("Please select both start and end dates.");
        return;
      }

      setIsSubmitting(true);

      const inputPayload: ReportInputPayload = {};
      const meta = safeParse(metaAdsJson);
      if (meta) inputPayload.metaAds = meta;
      const google = safeParse(googleAdsJson);
      if (google) inputPayload.googleAds = google;
      const ga4 = safeParse(ga4Json);
      if (ga4) inputPayload.ga4 = ga4;
      const gsc = safeParse(gscJson);
      if (gsc) inputPayload.gsc = gsc;
      const assets = safeParse(assetsJson);
      if (assets) inputPayload.topPerformingAssets = assets;
      const social = safeParse(socialJson);
      if (social) inputPayload.socialMediaMetrics = social;
      const video = safeParse(videoJson);
      if (video) inputPayload.videoProdMetrics = video;
      const crm = safeParse(crmJson);
      if (crm) inputPayload.crmMetrics = crm;
      if (emailLogs.trim()) inputPayload.emailLogs = emailLogs;

      try {
        const res = await fetch(`/api/cm/${clientId}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            period_start: periodStart,
            period_end: periodEnd,
            package_tier: tier,
            input_payload: inputPayload,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to create report.");
          return;
        }

        const { report } = await res.json();
        onCreated?.(report.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      periodStart, periodEnd, tier, emailLogs,
      metaAdsJson, googleAdsJson, ga4Json, gscJson, assetsJson,
      socialJson, videoJson, crmJson,
      clientId, safeParse, onCreated,
    ]
  );

  const fieldClass =
    "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5";
  const textareaClass = `${fieldClass} min-h-[80px] font-mono text-xs`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Period & Tier */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Period Start</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Period End</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Package Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as PackageTier)}
            className={fieldClass}
          >
            {(Object.entries(PACKAGE_LABELS) as [PackageTier, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Email Logs */}
      <div>
        <label className={labelClass}>Weekly Email Logs</label>
        <textarea
          value={emailLogs}
          onChange={(e) => setEmailLogs(e.target.value)}
          className={`${fieldClass} min-h-[120px]`}
          placeholder="Paste weekly email summaries here..."
        />
      </div>

      {/* Data Sources */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Meta Ads Data (JSON)</label>
          <textarea
            value={metaAdsJson}
            onChange={(e) => setMetaAdsJson(e.target.value)}
            className={textareaClass}
            placeholder='{"impressions": 50000, "clicks": 1200, ...}'
          />
        </div>
        <div>
          <label className={labelClass}>Google Ads Data (JSON)</label>
          <textarea
            value={googleAdsJson}
            onChange={(e) => setGoogleAdsJson(e.target.value)}
            className={textareaClass}
            placeholder='{"impressions": 30000, "clicks": 800, ...}'
          />
        </div>
        <div>
          <label className={labelClass}>GA4 Analytics (JSON)</label>
          <textarea
            value={ga4Json}
            onChange={(e) => setGa4Json(e.target.value)}
            className={textareaClass}
            placeholder='{"sessions": 5000, "users": 3200, ...}'
          />
        </div>
        <div>
          <label className={labelClass}>GSC Search Console (JSON)</label>
          <textarea
            value={gscJson}
            onChange={(e) => setGscJson(e.target.value)}
            className={textareaClass}
            placeholder='{"totalClicks": 2000, "topQueries": [...], ...}'
          />
        </div>
        <div>
          <label className={labelClass}>Top Performing Assets (JSON Array)</label>
          <textarea
            value={assetsJson}
            onChange={(e) => setAssetsJson(e.target.value)}
            className={textareaClass}
            placeholder='[{"name": "...", "type": "ad", "funnelStage": "awareness", ...}]'
          />
        </div>
        <div>
          <label className={labelClass}>Social Media Metrics (JSON)</label>
          <textarea
            value={socialJson}
            onChange={(e) => setSocialJson(e.target.value)}
            className={textareaClass}
            placeholder='{"postsPublished": 12, "totalEngagement": 5000, ...}'
          />
        </div>
        {(tier === "growth" || tier === "full_partnership") && (
          <div>
            <label className={labelClass}>Video Production (JSON)</label>
            <textarea
              value={videoJson}
              onChange={(e) => setVideoJson(e.target.value)}
              className={textareaClass}
              placeholder='{"videosProduced": 3, "totalViews": 15000, ...}'
            />
          </div>
        )}
        {tier === "full_partnership" && (
          <div>
            <label className={labelClass}>CRM & Advocacy (JSON)</label>
            <textarea
              value={crmJson}
              onChange={(e) => setCrmJson(e.target.value)}
              className={textareaClass}
              placeholder='{"activeContacts": 500, "newLeads": 45, ...}'
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {isSubmitting ? "Creating…" : "Create Report Draft"}
      </button>
    </form>
  );
}
