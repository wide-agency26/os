"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  approvePlanProposals,
  createArticleDraft,
  planBlogFromNeeds,
  runArticleResearch,
  saveBlogSettings,
  scrapeLiveBlog,
  setBlogArticleClientVisible,
  startOvernightRun,
  translateBlogArticle,
} from "@/app/actions/blog-builder";
import type {
  BlogArticle,
  BlogOpportunity,
  BlogRunSummary,
  BlogSettings,
  CorpusEntry,
  PlanProposal,
  ResearchDossier,
} from "@/lib/blog/types";
import { DEFAULT_PLAN_PROMPT } from "@/lib/blog/types";
import { ClientVisibleToggle } from "@/components/client/ClientVisibleToggle";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { workPaths } from "@/lib/work/paths";
import { useTouchRecentProject } from "@/components/tools/useTouchRecentProject";
import { monthLabel, shiftMonth } from "@/lib/content/types";

function researchUi(a: BlogArticle): string[] {
  const r = a.research as ResearchDossier | Record<string, unknown>;
  if (Array.isArray(r?.ui_summary) && r.ui_summary.length) return r.ui_summary.map(String).slice(0, 5);
  if (typeof r?.summary === "string" && r.summary) {
    return r.summary
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
  }
  return [];
}

function hasResearch(a: BlogArticle) {
  return researchUi(a).length > 0 || Boolean((a.research as ResearchDossier)?.summary);
}

function hasBody(a: BlogArticle) {
  return Boolean(a.body_md?.trim());
}

function liveUrl(a: BlogArticle, lang: string) {
  return a.published_urls?.[lang] || (a.language === lang ? a.published_url : null) || null;
}

function isFullyLive(a: BlogArticle, langs: string[]) {
  return langs.every((l) => Boolean(liveUrl(a, l)));
}

function LangChips({ article, langs }: { article: BlogArticle; langs: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {langs.map((l) => {
        const url = liveUrl(article, l);
        return url ? (
          <a
            key={l}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-emerald-50 text-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase"
          >
            {l} live
          </a>
        ) : (
          <span
            key={l}
            className="rounded-md bg-surface-raised text-text-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase"
          >
            {l} not live
          </span>
        );
      })}
    </span>
  );
}

export function BlogBuilderApp({
  projectId,
  title,
  clientLabel,
  settings,
  opportunities,
  articles,
  corpus,
  runs,
  activeJob,
}: {
  projectId: string;
  title: string;
  clientLabel?: string;
  settings: BlogSettings;
  opportunities: BlogOpportunity[];
  articles: BlogArticle[];
  corpus: CorpusEntry[];
  runs: { id: string; status: string; summary: BlogRunSummary | Record<string, unknown>; started_at: string }[];
  activeJob: { id: string; status: string; error?: string | null } | null;
}) {
  useTouchRecentProject("blog", projectId);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const langs = settings.languages.length ? settings.languages : ["de", "en"];

  const [needs, setNeeds] = useState("");
  const [ideaPrompt, setIdeaPrompt] = useState(settings.plan_prompt || DEFAULT_PLAN_PROMPT);
  const [proposals, setProposals] = useState<PlanProposal[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [planOpen, setPlanOpen] = useState(false);

  useEffect(() => {
    const stale =
      !settings.last_scrape_at ||
      Date.now() - new Date(settings.last_scrape_at).getTime() > 2 * 60 * 60 * 1000;
    if (!settings.site_url || !stale) return;
    void scrapeLiveBlog(projectId).then(() => router.refresh());
  }, [projectId, settings.last_scrape_at, settings.site_url, router]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) setMsg(res.error || "Failed");
      else {
        if (okMsg) setMsg(okMsg);
        router.refresh();
      }
    });
  }

  const livePosts = articles.filter((a) => isFullyLive(a, langs));
  const queue = articles.filter((a) => !isFullyLive(a, langs));
  const next = queue[0] || null;
  const liveFromCorpus = corpus.filter((c) => c.kind === "blog" && c.url);

  return (
    <ProjectPmShell projectId={projectId} title={title} clientLabel={clientLabel}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Blog</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              Next post to ship, then live {langs.map((l) => l.toUpperCase()).join(" / ")} on the site.
              Indexes are scraped automatically.
            </p>
          </div>
          <button
            type="button"
            disabled={pending || !settings.site_url}
            onClick={() =>
              start(async () => {
                setMsg(null);
                const res = await scrapeLiveBlog(projectId);
                if (!res.ok) setMsg(res.error);
                else {
                  setMsg(`Scraped ${res.liveCount} live posts · matched ${res.matched}`);
                  router.refresh();
                }
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold text-text-secondary hover:text-text-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh live
          </button>
        </div>

        {activeJob ? (
          <p className="text-[12px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Job {activeJob.status}
            {activeJob.error ? ` — ${activeJob.error}` : " — working in the background."}
          </p>
        ) : null}
        {msg ? (
          <p className="text-[12px] rounded-md border border-border bg-surface-raised px-3 py-2">{msg}</p>
        ) : null}

        {next ? (
          <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Next up</p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-text-primary">{next.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <LangChips article={next} langs={langs} />
                  <span className="text-[11px] text-text-muted">
                    {hasBody(next) ? "Draft ready" : hasResearch(next) ? "Research ready" : "Needs research"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!hasResearch(next) ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md bg-accent text-white px-3 py-2 text-[12px] font-semibold"
                    onClick={() => run(() => runArticleResearch(next.id, projectId), "Research started")}
                  >
                    Research
                  </button>
                ) : null}
                {hasResearch(next) && !hasBody(next) ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md bg-accent text-white px-3 py-2 text-[12px] font-semibold"
                    onClick={() => run(() => createArticleDraft(next.id, projectId), "Creating draft…")}
                  >
                    Write draft
                  </button>
                ) : null}
                {hasBody(next) ? (
                  <Link
                    href={workPaths.projectBlogArticle(projectId, next.id)}
                    className="rounded-md bg-accent text-white px-3 py-2 text-[12px] font-semibold"
                  >
                    Open & publish
                  </Link>
                ) : null}
                {hasBody(next) && langs.some((l) => l !== next.language && !next.translations?.[l]) ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-border px-3 py-2 text-[12px] font-semibold"
                    onClick={() => run(() => translateBlogArticle(next.id, projectId), "Translation started")}
                  >
                    Translate {langs.filter((l) => l !== next.language).join("/").toUpperCase()}
                  </button>
                ) : null}
              </div>
            </div>
            {researchUi(next).length ? (
              <ul className="text-[13px] text-text-secondary list-disc pl-4 space-y-0.5">
                {researchUi(next).slice(0, 3).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-border px-4 py-6 text-[13px] text-text-secondary">
            Nothing in the queue. Plan the next posts below.
          </section>
        )}

        {queue.length > 1 ? (
          <section className="space-y-1.5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">Queue</h3>
            <ul className="space-y-1">
              {queue.slice(1).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={workPaths.projectBlogArticle(projectId, a.id)}
                      className="text-[13px] font-medium text-text-primary hover:underline"
                    >
                      {a.title}
                    </Link>
                    <div className="mt-1">
                      <LangChips article={a} langs={langs} />
                    </div>
                  </div>
                  <Link
                    href={workPaths.projectBlogArticle(projectId, a.id)}
                    className="text-[12px] font-semibold text-text-secondary"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-1.5">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            Live on site
            {liveFromCorpus.length ? ` · ${liveFromCorpus.length} scraped` : ""}
          </h3>
          {livePosts.length || liveFromCorpus.length ? (
            <ul className="space-y-1">
              {livePosts.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-text-primary">{a.title}</div>
                    <div className="mt-1">
                      <LangChips article={a} langs={langs} />
                    </div>
                  </div>
                  <Link
                    href={workPaths.projectBlogArticle(projectId, a.id)}
                    className="text-[12px] text-text-secondary"
                  >
                    Edit
                  </Link>
                </li>
              ))}
              {liveFromCorpus
                .filter((c) => !livePosts.some((a) => liveUrl(a, c.language || langs[0]) === c.url))
                .slice(0, 12)
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px]">
                    <span className="text-text-secondary truncate">{c.title}</span>
                    <span className="uppercase text-[10px] font-semibold text-emerald-800">
                      {(c.language || "").toUpperCase() || "live"}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-[13px] text-text-muted">
              {settings.site_url
                ? "No live posts matched yet. Refresh after the scrape."
                : "Set the site URL in Settings so we can scrape /blog and /en/blog."}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border p-4 space-y-3">
          <button
            type="button"
            onClick={() => setPlanOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
              <Sparkles className="w-3.5 h-3.5" /> Plan next posts
            </span>
            <span className="text-[12px] text-text-muted">{planOpen ? "Hide" : "Show"}</span>
          </button>
          {planOpen || proposals.length ? (
            <div className="space-y-3">
              <label className="block text-[12px] text-text-secondary">
                Idea prompt — add or remove lines before generating
                <textarea
                  value={ideaPrompt}
                  onChange={(e) => setIdeaPrompt(e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-md border border-border px-3 py-2 text-[13px] bg-surface"
                />
              </label>
              <label className="block text-[12px] text-text-secondary">
                Extra focus (optional)
                <input
                  value={needs}
                  onChange={(e) => setNeeds(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border px-3 py-2 text-[13px] bg-surface"
                  placeholder="e.g. switcher objections for DACH CTOs this month"
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setMsg(null);
                    const res = await planBlogFromNeeds(projectId, needs, undefined, ideaPrompt);
                    if (!res.ok) {
                      setMsg(res.error);
                      return;
                    }
                    setProposals(res.proposals);
                    setSelected(Object.fromEntries(res.proposals.map((_, i) => [i, true])));
                    setMsg(`${res.proposals.length} proposals from live posts + web search`);
                  })
                }
                className="rounded-md bg-accent text-white px-3 py-2 text-[13px] font-semibold"
              >
                Search & propose ≥3
              </button>
              {proposals.length ? (
                <ul className="space-y-2">
                  {proposals.map((p, i) => (
                    <li key={`${p.title}-${i}`} className="flex gap-2 rounded-md border border-border px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[i])}
                        onChange={(e) => setSelected((s) => ({ ...s, [i]: e.target.checked }))}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-text-primary">{p.title}</div>
                        {p.titles && Object.keys(p.titles).length > 1 ? (
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {Object.entries(p.titles)
                              .map(([l, t]) => `${l.toUpperCase()}: ${t}`)
                              .join(" · ")}
                          </p>
                        ) : null}
                        <p className="text-[12px] text-text-secondary mt-0.5">{p.angle}</p>
                        <p className="text-[11px] text-text-muted mt-1">{p.why}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {proposals.length ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const picked = proposals.filter((_, i) => selected[i]);
                      const res = await approvePlanProposals(projectId, picked);
                      if (!res.ok) return res;
                      for (const id of res.articleIds) {
                        await runArticleResearch(id, projectId);
                      }
                      setProposals([]);
                      return res;
                    }, "Approved — research started")
                  }
                  className="rounded-md border border-border px-3 py-2 text-[12px] font-semibold"
                >
                  Approve selected
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-[13px] font-medium text-text-primary">Calendar</summary>
          <div className="mt-3">
            <StaffBlogCalendar projectId={projectId} articles={articles} />
          </div>
        </details>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-[13px] font-medium text-text-primary">Settings</summary>
          <div className="mt-3">
            <SettingsForm
              projectId={projectId}
              settings={settings}
              corpusCount={corpus.length}
              fileRef={fileRef}
              pending={pending}
              onSave={(patch) => run(() => saveBlogSettings(projectId, patch), "Saved")}
              onImport={(fd) => {
                fd.append("projectId", projectId);
                void (async () => {
                  setMsg(null);
                  try {
                    const res = await fetch("/api/blog/corpus", { method: "POST", body: fd });
                    const json = (await res.json().catch(() => null)) as {
                      ok?: boolean;
                      error?: string;
                    } | null;
                    if (!res.ok || !json?.ok) {
                      setMsg(json?.error || `Import failed (${res.status})`);
                      return;
                    }
                    setMsg("Imported");
                    router.refresh();
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Import failed");
                  }
                })();
              }}
              onOvernight={() => run(() => startOvernightRun(projectId), "Overnight job started")}
              runs={runs}
            />
          </div>
        </details>

        {pending ? (
          <div className="fixed bottom-4 right-4 rounded-md bg-gray-900 text-white px-3 py-2 text-[12px] inline-flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Working…
          </div>
        ) : null}
      </div>
    </ProjectPmShell>
  );
}

function MonitorTab({
  projectId,
  articles,
  pending,
  onSave,
}: {
  projectId: string;
  articles: BlogArticle[];
  pending: boolean;
  onSave: (id: string, url: string, insights: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, { url: string; notes: string }>>(() =>
    Object.fromEntries(
      articles.map((a) => [a.id, { url: a.published_url || "", notes: a.monitor_insights || "" }])
    )
  );

  if (!articles.length) {
    return <p className="text-[13px] text-gray-500">Create and publish a post, then paste the live URL here.</p>;
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-[13px] text-gray-600">
        Paste the live URL when it&apos;s live. Notes here feed the next Plan so each post compounds.
      </p>
      {articles.map((a) => {
        const d = drafts[a.id] || { url: a.published_url || "", notes: a.monitor_insights || "" };
        return (
          <div key={a.id} className="rounded-lg border border-gray-200 p-4 space-y-2">
            <div className="text-[14px] font-medium text-gray-900">{a.title}</div>
            <label className="block text-[12px] text-gray-600">
              Published URL
              <input
                value={d.url}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [a.id]: { ...d, url: e.target.value } }))
                }
                placeholder="https://…"
                className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
              />
            </label>
            <label className="block text-[12px] text-gray-600">
              Insights for next plan
              <textarea
                value={d.notes}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [a.id]: { ...d, notes: e.target.value } }))
                }
                rows={2}
                placeholder="What performed, what to continue or avoid…"
                className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => onSave(a.id, d.url, d.notes)}
                className="rounded-md bg-gray-900 text-white px-2.5 py-1.5 text-[12px]"
              >
                Save
              </button>
              <Link href={workPaths.projectBlogArticle(projectId, a.id)} className="text-[12px] text-gray-500">
                Open article
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StaffBlogCalendar({ projectId, articles }: { projectId: string; articles: BlogArticle[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<"month" | "list">("month");
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );

  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cells = useMemo(() => {
    const [y, m] = period.slice(0, 7).split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const out: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let d = 1; d <= last; d++) {
      out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [period]);

  const byDate: Record<string, BlogArticle[]> = {};
  const unscheduled: BlogArticle[] = [];
  for (const a of articles) {
    const d = a.scheduled_for || a.published_at?.slice(0, 10) || null;
    if (!d) unscheduled.push(a);
    else (byDate[d] ||= []).push(a);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPeriod(shiftMonth(period, -1))}
            className="rounded-md border border-gray-200 px-2 py-1 text-[12px]"
          >
            ←
          </button>
          <span className="text-[14px] font-medium px-2">{monthLabel(period)}</span>
          <button
            type="button"
            onClick={() => setPeriod(shiftMonth(period, 1))}
            className="rounded-md border border-gray-200 px-2 py-1 text-[12px]"
          >
            →
          </button>
        </div>
        <div className="flex gap-1">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 text-[12px] capitalize ${
                view === v ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-600"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 inline-flex items-center gap-1">
        <Eye className="w-3 h-3" /> Client eye: show on client blog calendar
      </p>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-gray-50 px-2 py-1.5 text-[11px] font-semibold text-gray-500">
              {d}
            </div>
          ))}
          {cells.map((iso, i) => (
            <div key={i} className="bg-white min-h-[88px] p-1.5">
              {iso ? (
                <>
                  <div className="text-[11px] text-gray-400 mb-1">{Number(iso.slice(-2))}</div>
                  {(byDate[iso] || []).map((a) => (
                    <div key={a.id} className="flex items-start gap-0.5 mb-1">
                      <ClientVisibleToggle
                        visible={a.client_visible !== false}
                        disabled={pending}
                        onChange={(next) => {
                          start(async () => {
                            await setBlogArticleClientVisible(projectId, a.id, next);
                            router.refresh();
                          });
                        }}
                      />
                      <Link
                        href={workPaths.projectBlogArticle(projectId, a.id)}
                        className="text-[11px] leading-snug text-gray-800 line-clamp-2"
                      >
                        {a.title}
                        <span className="text-gray-400"> · {a.status}</span>
                      </Link>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {(view === "list" || true) && view === "list" ? (
        <ul className="space-y-2">
          {Object.keys(byDate)
            .sort()
            .map((d) => (
              <li key={d}>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{d}</div>
                {byDate[d].map((a) => (
                  <CalendarRow key={a.id} a={a} projectId={projectId} pending={pending} start={start} router={router} />
                ))}
              </li>
            ))}
        </ul>
      ) : null}

      {unscheduled.length ? (
        <section>
          <h3 className="text-[12px] font-semibold text-gray-700 mb-1">Unscheduled</h3>
          <ul className="space-y-1">
            {unscheduled.map((a) => (
              <CalendarRow key={a.id} a={a} projectId={projectId} pending={pending} start={start} router={router} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CalendarRow({
  a,
  projectId,
  pending,
  start,
  router,
}: {
  a: BlogArticle;
  projectId: string;
  pending: boolean;
  start: ReturnType<typeof useTransition>[1];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-md border border-gray-100 px-2 py-1.5 text-[13px] ${
        a.client_visible === false ? "opacity-60" : ""
      }`}
    >
      <ClientVisibleToggle
        visible={a.client_visible !== false}
        disabled={pending}
        onChange={(next) => {
          start(async () => {
            await setBlogArticleClientVisible(projectId, a.id, next);
            router.refresh();
          });
        }}
      />
      <Link href={workPaths.projectBlogArticle(projectId, a.id)} className="flex-1 min-w-0 truncate">
        {a.title} <span className="text-gray-400">· {a.status}</span>
      </Link>
    </div>
  );
}

function SettingsForm({
  projectId,
  settings,
  corpusCount,
  fileRef,
  pending,
  onSave,
  onImport,
  onOvernight,
  runs,
}: {
  projectId: string;
  settings: BlogSettings;
  corpusCount: number;
  fileRef: RefObject<HTMLInputElement | null>;
  pending: boolean;
  onSave: (patch: Partial<BlogSettings>) => void;
  onImport: (fd: FormData) => void;
  onOvernight: () => void;
  runs: { id: string; status: string; summary: BlogRunSummary | Record<string, unknown>; started_at: string }[];
}) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [autonomy, setAutonomy] = useState(settings.autonomy);
  const [siteUrl, setSiteUrl] = useState(settings.site_url || "");
  const [langs, setLangs] = useState(settings.languages.join(", "));
  const [notes, setNotes] = useState(settings.brand_notes);
  const [domains, setDomains] = useState(settings.preferred_external_domains.join(", "));
  const [commercial, setCommercial] = useState(
    settings.commercial_pages.map((p) => `${p.label} | ${p.url}`).join("\n")
  );
  const [webhook, setWebhook] = useState(settings.webhook_url || "");
  const [maxDrafts, setMaxDrafts] = useState(String(settings.max_drafts_per_night));
  const [maxOpps, setMaxOpps] = useState(String(settings.max_opportunities_per_night));
  const [minScore, setMinScore] = useState(String(settings.seo_min_score));

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-[13px] text-gray-600">
        Tone, languages, and CTA pages shape every Plan → Create run. Overnight is optional Advanced.
      </p>
      <label className="block text-[13px]">
        Site URL
        <input
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2"
          placeholder="https://www.sign2x.com"
        />
      </label>
      <label className="block text-[13px]">
        Languages (first = primary)
        <input
          value={langs}
          onChange={(e) => setLangs(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2"
        />
      </label>
      <label className="block text-[13px]">
        Brand / editorial notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2"
          placeholder="eIDAS, data sovereignty, white-label API, CTOs in DACH…"
        />
      </label>
      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer text-[12px] font-medium text-gray-700">Optional extras</summary>
        <div className="mt-3 space-y-3">
      <label className="block text-[13px]">
        Preferred external domains (comma)
        <input
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2"
        />
      </label>
      <label className="block text-[13px]">
        Commercial pages (label | url per line)
        <textarea
          value={commercial}
          onChange={(e) => setCommercial(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2"
          placeholder="Evaluation quiz | https://www.sign2x.com/quiz"
        />
      </label>
      <label className="block text-[13px]">
        Publish webhook (optional)
        <input
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2"
        />
      </label>
        </div>
      </details>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          onSave({
            enabled,
            autonomy,
            site_url: siteUrl || null,
            languages: langs
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean),
            brand_notes: notes,
            preferred_external_domains: domains
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            commercial_pages: commercial
              .split("\n")
              .map((line) => {
                const [label, url] = line.split("|").map((s) => s.trim());
                return url ? { label: label || url, url } : null;
              })
              .filter(Boolean) as { label: string; url: string }[],
            webhook_url: webhook || null,
            max_drafts_per_night: Math.min(8, Number(maxDrafts) || 3),
            max_opportunities_per_night: Math.min(40, Number(maxOpps) || 8),
            seo_min_score: Number(minScore) || 70,
          })
        }
        className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-[13px]"
      >
        Save settings
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="ml-2 rounded-md border border-gray-200 px-3 py-1.5 text-[13px]"
      >
        Import corpus ({corpusCount})
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".csv,.txt,.md,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          onImport(fd);
        }}
      />

      <details className="rounded-lg border border-gray-200 p-3 mt-4">
        <summary className="cursor-pointer text-[13px] font-medium text-gray-800">Advanced — overnight</summary>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enable overnight job
          </label>
          <label className="block text-[13px]">
            Autonomy
            <select
              value={autonomy}
              onChange={(e) => setAutonomy(e.target.value as BlogSettings["autonomy"])}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2"
            >
              <option value="assisted">Assisted</option>
              <option value="autonomous">Autonomous</option>
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[12px]">
              Max drafts
              <input
                type="number"
                value={maxDrafts}
                onChange={(e) => setMaxDrafts(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5"
              />
            </label>
            <label className="text-[12px]">
              Max opps
              <input
                type="number"
                value={maxOpps}
                onChange={(e) => setMaxOpps(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5"
              />
            </label>
            <label className="text-[12px]">
              Min SEO
              <input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onOvernight}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px]"
          >
            Run overnight pipeline now
          </button>
          {runs[0] ? (
            <p className="text-[11px] text-gray-500">
              Last run {new Date(runs[0].started_at).toLocaleString()} · {runs[0].status}
            </p>
          ) : null}
        </div>
      </details>
      <p className="text-[12px] text-gray-400">Project {projectId.slice(0, 8)}…</p>
    </div>
  );
}
