"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Link2,
  Loader2,
  PlugZap,
  RefreshCw,
  Unplug,
  Upload,
} from "lucide-react";
import { LIVE_PROVIDERS, type DataProvider } from "@/lib/reports/sync/providers";
import { relativeAge } from "@/lib/reports/freshness";
import { subcategoryLabel } from "@/lib/data-hub/subcategory";

interface ConnectionRow {
  id: string;
  provider: string;
  status: string;
  external_account_id: string | null;
  external_account_label: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

interface StreamRow {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  source_type: string | null;
  synced_at: string | null;
  created_at: string | null;
  row_count: number;
  external_account_label: string | null;
}

interface FileOnly {
  id: string;
  label: string;
  tab: string;
  hint: string;
  acceptHint: string;
}

interface MetaAppStatus {
  configured: boolean;
  appId: string | null;
  companyName: string | null;
  companyId: string | null;
  scope: "project" | "company" | "env" | null;
  encryptionReady: boolean;
}

interface SourcesPayload {
  google: { connected: boolean; hasAnalytics: boolean; hasSearchConsole: boolean };
  metaConfigured: boolean;
  metaApp?: MetaAppStatus;
  googleAdsConfigured?: boolean;
  connections: ConnectionRow[];
  streams: StreamRow[];
  accounts: {
    ga4: { id: string; label: string }[];
    gsc: { id: string; label: string }[];
    metaAds: { id: string; label: string }[];
    instagram: { id: string; label: string }[];
    youtube?: { id: string; label: string }[];
    googleAds?: { id: string; label: string }[];
  };
  fileOnly: FileOnly[];
}

interface SourcesConnectionsProps {
  projectId: string;
  highlight?: string | null;
  onUpload?: (platformId?: string) => void;
  onChanged?: () => void;
}

export function SourcesConnections({
  projectId,
  highlight,
  onUpload,
  onChanged,
}: SourcesConnectionsProps) {
  const [data, setData] = useState<SourcesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [metaAppId, setMetaAppId] = useState("");
  const [metaSecret, setMetaSecret] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/sources?projectId=${encodeURIComponent(projectId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load sources");
      setData(json);
      if (json.metaApp?.appId && json.metaApp.scope !== "env") {
        setMetaAppId(json.metaApp.appId);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; ok?: boolean; error?: string; intent?: string };
      if (data?.type !== "wide-google-oauth") return;
      if (data.ok) {
        setMessage(
          data.intent === "youtube"
            ? "YouTube connected. Pick the channel, then Sync."
            : "Google Ads connected. Pick the account, then Sync."
        );
        void load();
        onChanged?.();
      } else if (data.error) {
        setMessage(String(data.error));
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [load, onChanged]);

  async function saveMetaApp() {
    setBusy("meta_app");
    setMessage(null);
    try {
      const res = await fetch("/api/reports/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          action: "save_meta_app",
          appId: metaAppId,
          appSecret: metaSecret,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMetaSecret("");
      setMessage(
        json.metaApp?.companyName
          ? `Meta app saved for ${json.metaApp.companyName}. Secret is stored encrypted.`
          : "Meta app saved. Secret is stored encrypted."
      );
      await load();
      onChanged?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveAccount(provider: DataProvider, id: string, label: string) {
    setBusy(provider);
    setMessage(null);
    try {
      const res = await fetch("/api/reports/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          provider,
          externalAccountId: id,
          externalAccountLabel: label,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await load();
      onChanged?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: DataProvider) {
    setBusy(provider);
    try {
      await fetch("/api/reports/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, provider, action: "disconnect" }),
      });
      await load();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  async function syncNow(providers?: DataProvider[]) {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetch("/api/reports/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, providers: providers ?? "all" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setMessage(json.message || "Synced.");
      await load();
      onChanged?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  }

  if (!projectId) {
    return (
      <p className="text-[13px] text-gray-500 mb-6">Select a project to connect sources.</p>
    );
  }

  if (loading && !data) {
    return (
      <div className="py-10 text-center text-gray-400">
        <Loader2 className="animate-spin mx-auto mb-2" size={18} />
        Loading sources…
      </div>
    );
  }

  function openGoogleAccountWindow(intent: "youtube" | "google_ads") {
    const url = `/api/integrations/google/connect?intent=${intent}&popup=1&project=${encodeURIComponent(projectId)}&next=${encodeURIComponent("/app/projects/report-data")}`;
    const w = window.open(
      url,
      `wide-google-${intent}`,
      "popup=yes,width=540,height=760,menubar=no,toolbar=no,location=yes,status=no"
    );
    if (!w) {
      window.location.href = url.replace("popup=1", "popup=0");
    }
  }
  const googleNext = `/api/integrations/google/connect?next=${encodeURIComponent("/app/projects/report-data")}&project=${encodeURIComponent(projectId)}`;
  const metaNext = `/api/integrations/meta/connect?next=${encodeURIComponent("/app/projects/report-data")}&project=${encodeURIComponent(projectId)}`;
  const conn = (id: DataProvider) => data?.connections.find((c) => c.provider === id && c.status !== "revoked");
  const meta = data?.metaApp;
  const metaSaved = !!(meta?.configured && meta.scope !== "env");
  const clientLabel = meta?.companyName || "this client";

  return (
    <div className="space-y-8 mb-8">
      {message && (
        <p className="text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Meta app · {clientLabel}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
              Each client has their own Meta developer app. Ads and Instagram share it, and it
              saves on the company so other projects inherit it.
            </p>
          </div>
          {metaSaved ? (
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Saved
            </span>
          ) : null}
        </div>
        {meta?.scope === "env" ? (
          <p className="mt-2 text-[11px] text-amber-800">
            Using the WIDE fallback app. Paste this client’s App ID and secret to isolate them.
          </p>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] text-gray-500">App ID</span>
            <input
              value={metaAppId}
              onChange={(e) => setMetaAppId(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="123456789012345"
              className="mt-0.5 w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-[12px] bg-white"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">
              {metaSaved ? "App secret (leave blank to keep)" : "App secret"}
            </span>
            <input
              type="password"
              value={metaSecret}
              onChange={(e) => setMetaSecret(e.target.value)}
              autoComplete="new-password"
              placeholder={metaSaved ? "••••••••" : ""}
              className="mt-0.5 w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-[12px] bg-white"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy === "meta_app" || !metaAppId.trim() || (!metaSaved && !metaSecret.trim())}
          onClick={() => void saveMetaApp()}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-900 underline disabled:opacity-40 disabled:no-underline"
        >
          {busy === "meta_app" ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          {metaSaved ? "Update Meta app" : "Save Meta app"}
        </button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-gray-900">Connected</h3>
          <button
            type="button"
            disabled={busy === "sync"}
            onClick={() => void syncNow()}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
          >
            <RefreshCw size={13} className={busy === "sync" ? "animate-spin" : ""} />
            Sync all
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {LIVE_PROVIDERS.map((p) => {
            const row = conn(p.id);
            const accounts =
              p.id === "google_analytics"
                ? data?.accounts.ga4 ?? []
                : p.id === "google_search_console"
                  ? data?.accounts.gsc ?? []
                  : p.id === "google_ads"
                    ? data?.accounts.googleAds ?? []
                    : p.id === "youtube"
                      ? data?.accounts.youtube ?? []
                      : p.id === "meta_ads"
                        ? data?.accounts.metaAds ?? []
                        : data?.accounts.instagram ?? [];
            const oauthReady =
              p.oauth === "google"
                ? data?.google.connected
                : p.oauth === "google_popup"
                  ? !!row
                  : row?.status === "connected" ||
                    !!data?.accounts.metaAds.length ||
                    !!data?.accounts.instagram.length;
            const needsGoogle = p.oauth === "google" && !data?.google.connected;
            const needsPopup = p.oauth === "google_popup" && !row;
            const needsMeta = p.oauth === "meta" && !oauthReady && !data?.metaConfigured;

            return (
              <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-900">{p.label}</p>
                    <p className="text-[11px] text-gray-500">{p.tab}</p>
                  </div>
                  <StatusPill status={row?.status} connected={!!row} />
                </div>

                {needsGoogle ? (
                  <a
                    href={googleNext}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-900 underline"
                  >
                    <PlugZap size={13} /> Connect Google
                  </a>
                ) : needsPopup ? (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        openGoogleAccountWindow(p.id === "youtube" ? "youtube" : "google_ads")
                      }
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-900 underline"
                    >
                      <PlugZap size={13} /> Connect {p.label} in a new window
                    </button>
                    {p.hint ? <p className="text-[11px] text-gray-500 leading-snug">{p.hint}</p> : null}
                    {p.id === "youtube" ? (
                      <p className="text-[11px] text-gray-400 leading-snug">
                        A website cannot open a different Chrome user profile. If Google is stuck
                        on the WIDE inbox, pick another account in that window, or paste the
                        connect link into an Incognito window.
                      </p>
                    ) : null}
                    {p.id === "google_ads" && !data?.googleAdsConfigured ? (
                      <p className="text-[11px] text-amber-800">
                        Sync also needs GOOGLE_ADS_DEVELOPER_TOKEN in Vercel (Google Ads API Center).
                      </p>
                    ) : null}
                  </div>
                ) : p.oauth === "meta" && !row && data?.metaConfigured ? (
                  <a
                    href={metaNext}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-900 underline"
                  >
                    <PlugZap size={13} /> Connect Meta
                  </a>
                ) : needsMeta ? (
                  <p className="mt-3 text-[12px] text-gray-500">
                    Save this client’s Meta app above, then connect {p.label}.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <select
                      value={row?.external_account_id || ""}
                      disabled={busy === p.id}
                      onChange={(e) => {
                        const opt = accounts.find((a) => a.id === e.target.value);
                        if (opt) void saveAccount(p.id, opt.id, opt.label);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-[12px] bg-white"
                    >
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>
                        {row?.last_synced_at
                          ? `Last sync ${relativeAge(row.last_synced_at)}`
                          : "Never synced"}
                      </span>
                      <div className="flex gap-2">
                        {p.oauth === "google_popup" ? (
                          <button
                            type="button"
                            onClick={() =>
                              openGoogleAccountWindow(p.id === "youtube" ? "youtube" : "google_ads")
                            }
                            className="font-medium text-slate-800 hover:underline"
                          >
                            Switch account
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!row?.external_account_id || busy === "sync"}
                          onClick={() => void syncNow([p.id])}
                          className="font-medium text-slate-800 hover:underline disabled:opacity-40"
                        >
                          Sync now
                        </button>
                        {row ? (
                          <button
                            type="button"
                            onClick={() => void disconnect(p.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Disconnect"
                          >
                            <Unplug size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {row?.last_error ? (
                      <p className="text-[11px] text-amber-800">{row.last_error}</p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {data?.google.connected && !data.google.hasAnalytics ? (
          <p className="mt-2 text-[12px] text-amber-800">
            Google is connected but Analytics access is missing.{" "}
            <a href={googleNext} className="underline">
              Re-consent
            </a>{" "}
            to add the Analytics scope.
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-3">Needs a file</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.fileOnly ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onUpload?.(p.id)}
              className="text-left rounded-xl border border-dashed border-gray-300 bg-gray-50/60 hover:bg-white hover:border-slate-400 px-3.5 py-3"
            >
              <p className="text-[13px] font-semibold text-gray-900">{p.label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {p.tab} · {p.hint}
              </p>
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                <Upload size={12} /> {p.acceptHint}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-3">This project’s streams</h3>
        {(data?.streams ?? []).length === 0 ? (
          <p className="text-[13px] text-gray-500">No streams yet. Connect a source or upload a file.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {(data?.streams ?? []).map((s) => {
              const live = s.source_type === "sync";
              const asOf = s.synced_at || s.created_at;
              const lit = highlight && (s.subcategory === highlight || s.category.toLowerCase() === highlight);
              return (
                <div
                  key={s.id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 last:border-0 ${
                    lit ? "bg-amber-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 truncate">
                      {s.subcategory ? subcategoryLabel(s.subcategory as never) : s.name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {s.category}
                      {s.external_account_label ? ` · ${s.external_account_label}` : ""}
                      {` · ${s.row_count.toLocaleString()} rows`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        live ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {live ? "Live" : "File"}
                    </span>
                    <span className="text-gray-500">{relativeAge(asOf)}</span>
                    {live ? (
                      <button
                        type="button"
                        className="font-medium text-slate-800 hover:underline"
                        onClick={() => {
                          const provider = LIVE_PROVIDERS.find((p) =>
                            p.subcategories.includes(s.subcategory || "")
                          )?.id;
                          if (provider) void syncNow([provider]);
                        }}
                      >
                        Sync
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="font-medium text-slate-800 hover:underline"
                        onClick={() => onUpload?.()}
                      >
                        Replace file
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status, connected }: { status?: string; connected: boolean }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <Link2 size={11} /> Not connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Error</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
      <CheckCircle2 size={11} /> Connected
    </span>
  );
}
