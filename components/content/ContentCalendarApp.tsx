"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Printer,
} from "lucide-react";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import {
  approveAllAngles,
  approveAllPosts,
  createContentStory,
  markNotificationsRead,
  moveContentPost,
  saveContentSettings,
  seedPersonasFromCi,
  setCalendarStatus,
  setCalendarTheme,
  shareCalendarWithClient,
} from "@/app/actions/content-calendar";
import { ContextDocsPanel } from "@/components/content/ContextDocsPanel";
import { SocialKitAdminPanel } from "@/components/content/SocialKitAdminPanel";
import { CarryOverBanner } from "@/components/content/CarryOverBanner";
import { calendarToCsv } from "@/lib/content/export";
import { useTouchRecentProject } from "@/components/tools/useTouchRecentProject";
import {
  contentToday,
  isMissedPost,
  isPastScheduledDate,
  showOnPastDayGrid,
} from "@/lib/content/calendar-day";
import { isStoryPost } from "@/lib/content/formats";
import {
  APPROVAL_LABEL,
  CONTEXT_HARD_LIMIT,
  CONTEXT_SOFT_LIMIT,
  monthLabel,
  postLabel,
  shiftMonth,
  type AssembledContext,
  type CalendarStatus,
  type ContentCalendar,
  type ContentComment,
  type ContentPost,
  type ContentSettings,
  type ContextDoc,
} from "@/lib/content/types";
import { ContentPostCard } from "./ContentPostCard";
import { ContentStoryCard } from "./ContentStoryCard";
import { PostDrawer } from "./PostDrawer";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daysInMonth(periodStart: string) {
  const [y, m] = periodStart.slice(0, 7).split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= last; d++) {
    cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

type Filters = {
  platform: string;
  pillar: string;
  approval: string;
  production: string;
  /** feed | story | "" (all) */
  format: string;
  hideStories: boolean;
};

type CalendarViewMode = "month" | "week";
type CalendarDensity = "comfortable" | "expanded";

function weekStartMonday(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function ContentCalendarApp({
  projectId,
  title,
  clientLabel,
  brandAvatarUrl,
  periodStart,
  settings,
  calendar,
  posts,
  missedPosts = [],
  docs,
  comments,
  unread,
  context,
  initialPanel = "calendar",
}: {
  projectId: string;
  title: string;
  clientLabel?: string;
  brandAvatarUrl?: string | null;
  periodStart: string;
  settings: ContentSettings;
  calendar: ContentCalendar;
  posts: ContentPost[];
  missedPosts?: ContentPost[];
  docs: ContextDoc[];
  comments: ContentComment[];
  unread: number;
  context: AssembledContext;
  initialPanel?: "calendar" | "settings" | "context";
}) {
  useTouchRecentProject("content", projectId);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"calendar" | "settings" | "context">(initialPanel);
  const [filters, setFilters] = useState<Filters>({
    platform: "",
    pillar: "",
    approval: "",
    production: "",
    format: "",
    hideStories: true,
  });
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [density, setDensity] = useState<CalendarDensity>("comfortable");
  const [weekAnchor, setWeekAnchor] = useState(() => weekStartMonday(periodStart));
  const [dayDrawerIso, setDayDrawerIso] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [theme, setTheme] = useState(calendar.theme_notes || "");
  const [busyGen, setBusyGen] = useState<string | null>(null);
  const [pillars, setPillars] = useState(settings.pillars.join(", "));
  const [languages, setLanguages] = useState(settings.languages.join(", "));
  const [clientLangs, setClientLangs] = useState(settings.client_languages.join(", "));
  const [liPersona, setLiPersona] = useState(settings.platform_personas.linkedin || "");
  const [igPersona, setIgPersona] = useState(settings.platform_personas.instagram || "");
  const [liCadence, setLiCadence] = useState(String(settings.cadence.linkedin ?? 3));
  const [igCadence, setIgCadence] = useState(String(settings.cadence.instagram ?? 3));

  const openPost = posts.find((p) => p.id === openId) || null;
  const commentsByPost = useMemo(() => {
    const m: Record<string, ContentComment[]> = {};
    for (const c of comments) {
      (m[c.post_id] ||= []).push(c);
    }
    return m;
  }, [comments]);

  const filtered = posts.filter((p) => {
    if (filters.platform && !p.platforms.includes(filters.platform)) return false;
    if (filters.pillar && p.pillar !== filters.pillar) return false;
    if (filters.approval && p.status_approval !== filters.approval) return false;
    if (filters.production && p.status_production !== filters.production) return false;
    if (filters.hideStories && isStoryPost(p)) return false;
    if (filters.format === "story" && !isStoryPost(p)) return false;
    if (filters.format === "feed" && isStoryPost(p)) return false;
    return true;
  });

  const today = contentToday();
  const gridPosts = useMemo(() => {
    return filtered.filter((p) => {
      if (isMissedPost(p, today)) return false;
      if (isPastScheduledDate(p.scheduled_date, today) && !showOnPastDayGrid(p)) return false;
      return true;
    });
  }, [filtered, today]);

  const byDate = useMemo(() => {
    const m: Record<string, ContentPost[]> = {};
    for (const p of gridPosts) {
      (m[p.scheduled_date] ||= []).push(p);
    }
    return m;
  }, [gridPosts]);

  const postNumberById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of posts) m[p.id] = p.post_number;
    return m;
  }, [posts]);

  function splitDayPosts(dayPosts: ContentPost[]) {
    const feed: ContentPost[] = [];
    const stories: ContentPost[] = [];
    for (const p of dayPosts) {
      if (isStoryPost(p)) stories.push(p);
      else feed.push(p);
    }
    return { feed, stories };
  }

  const openDrawerFor = (p: ContentPost) => {
    setOpenId(p.id);
  };

  function goMonth(delta: number) {
    const next = shiftMonth(periodStart, delta);
    router.push(`/app/projects/${projectId}/content?month=${next}`);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      setMsg(null);
      try {
        const res = await fn();
        if (!res.ok) setMsg(res.error || "Failed");
        else {
          if (okMsg) setMsg(okMsg);
          router.refresh();
        }
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  async function generate(step: "angles" | "full", extra?: Record<string, unknown>) {
    setBusyGen(step);
    setMsg(null);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          projectId,
          periodStart,
          themeNotes: theme,
          ...extra,
        }),
      });
      const json = await res.json();
      if (!json.ok) setMsg(json.error || "Generation failed");
      else {
        const n = json.created || json.generated || 0;
        setMsg(
          step === "angles"
            ? `Planned ${n} angles. Review hooks, then generate copy.`
            : `Wrote copy for ${n} post${n === 1 ? "" : "s"}.`
        );
        router.refresh();
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusyGen(null);
    }
  }

  function exportCsv() {
    const csv = calendarToCsv(posts, settings);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/\s+/g, "-")}-${periodStart.slice(0, 7)}-content.csv`;
    a.click();
  }

  const cells = daysInMonth(periodStart);
  const ctxPct = Math.min(100, Math.round((context.chars / CONTEXT_HARD_LIMIT) * 100));

  return (
    <ProjectPmShell projectId={projectId} title={title} clientLabel={clientLabel}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goMonth(-1)} className="p-1 rounded hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{monthLabel(periodStart)}</h2>
            <button type="button" onClick={() => goMonth(1)} className="p-1 rounded hover:bg-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {posts.length} posts · next ID {postLabel(settings.next_post_number)} · cadence{" "}
            {settings.cadence.linkedin}/{settings.cadence.instagram} per week
            {unread ? (
              <button
                type="button"
                onClick={() => run(() => markNotificationsRead(projectId))}
                className="ml-2 text-amber-700 hover:underline"
              >
                {unread} client comment{unread === 1 ? "" : "s"}
              </button>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["calendar", "settings", "context"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPanel(p)}
              className={`px-2.5 py-1.5 rounded-md text-[12px] capitalize ${
                panel === p ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {msg ? (
        <p className="mb-3 text-[12px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
          {msg}
        </p>
      ) : null}

      {panel === "calendar" ? (
        <>
          <CarryOverBanner projectId={projectId} posts={missedPosts} />
          <div className="mb-3 space-y-2">
            <div className="rounded-md border border-emerald-200/80 bg-emerald-50/50 px-2.5 py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">
                  Client portal
                </p>
                <p className="text-[10px] text-emerald-900/55">
                  Clients see In review / Approved months · Share unlocks draft &amp; on-hold posts
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={calendar.status}
                  onChange={(e) =>
                    run(() =>
                      setCalendarStatus(
                        calendar.id,
                        projectId,
                        e.target.value as CalendarStatus
                      )
                    )
                  }
                  className="rounded-md border border-emerald-200 bg-white text-[12px] px-2 py-1.5"
                  title="Month visibility on the client portal"
                >
                  <option value="draft">Month: internal draft</option>
                  <option value="in_review">Month: shared for review</option>
                  <option value="approved">Month: approved for client</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () => shareCalendarWithClient(calendar.id, projectId),
                      "Shared with client"
                    )
                  }
                  className="rounded-md bg-emerald-800 text-white px-2.5 py-1.5 text-[12px]"
                >
                  Share with client
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () => approveAllPosts(calendar.id, projectId),
                      "Approved for client"
                    )
                  }
                  className="rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-[12px]"
                >
                  Approve all posts
                </button>
                <Link
                  href={`/app/client-content?project=${projectId}&month=${periodStart}`}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-[12px]"
                >
                  <ExternalLink className="w-3 h-3" /> Preview client view
                </Link>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white px-2.5 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Content production
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={filters.platform}
                  onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                  className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
                >
                  <option value="">All platforms</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="instagram">Instagram</option>
                </select>
                <select
                  value={filters.pillar}
                  onChange={(e) => setFilters({ ...filters, pillar: e.target.value })}
                  className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
                >
                  <option value="">All pillars</option>
                  {settings.pillars.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.approval}
                  onChange={(e) => setFilters({ ...filters, approval: e.target.value })}
                  className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
                >
                  <option value="">All approval</option>
                  {Object.entries(APPROVAL_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.production}
                  onChange={(e) => setFilters({ ...filters, production: e.target.value })}
                  className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
                >
                  <option value="">All production</option>
                  <option value="wip">WIP</option>
                  <option value="live">Live</option>
                </select>
                <select
                  value={filters.format}
                  onChange={(e) => setFilters({ ...filters, format: e.target.value })}
                  className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
                >
                  <option value="">All formats</option>
                  <option value="feed">Feed / reel</option>
                  <option value="story">Stories only</option>
                </select>
                <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={filters.hideStories}
                    onChange={(e) =>
                      setFilters({ ...filters, hideStories: e.target.checked })
                    }
                  />
                  Hide Stories
                </label>
                <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                  {(["month", "week"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setViewMode(m);
                        if (m === "week") setWeekAnchor(weekStartMonday(periodStart));
                      }}
                      className={`px-2.5 py-1.5 text-[12px] capitalize ${
                        viewMode === m ? "bg-gray-900 text-white" : "bg-white text-gray-700"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                  {(["comfortable", "expanded"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDensity(d)}
                      className={`px-2.5 py-1.5 text-[12px] capitalize ${
                        density === d ? "bg-gray-900 text-white" : "bg-white text-gray-700"
                      }`}
                    >
                      {d === "comfortable" ? "Comfort" : "Expanded"}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={!!busyGen}
                    onClick={() => void generate("angles", { replace: posts.length > 0 })}
                    className="rounded-md bg-gray-900 text-white px-2.5 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    {busyGen === "angles"
                      ? "Planning…"
                      : posts.length
                        ? "Replace angles"
                        : "Generate month"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busyGen}
                    onClick={() =>
                      run(() => approveAllAngles(calendar.id, projectId), "Angles approved")
                    }
                    className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px]"
                  >
                    Approve angles
                  </button>
                  <button
                    type="button"
                    disabled={!!busyGen}
                    onClick={() => void generate("full")}
                    className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    {busyGen === "full" ? "Writing…" : "Generate copy"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busyGen}
                    onClick={() => void generate("full", { regenerateDrafts: true })}
                    className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px]"
                  >
                    Regen drafts
                  </button>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px]"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                  <Link
                    href={`/app/projects/${projectId}/content/print?month=${periodStart}`}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px]"
                  >
                    <Printer className="w-3 h-3" /> Print
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <label className="block mb-3">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              Campaign / theme notes for this month
            </span>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              onBlur={() =>
                theme !== (calendar.theme_notes || "") &&
                run(() => setCalendarTheme(calendar.id, projectId, theme))
              }
              placeholder="e.g. Product launch week 2, summer hiring"
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-[13px]"
            />
          </label>

          {viewMode === "week" ? (
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-gray-200 px-2 py-1 text-[12px]"
                onClick={() => setWeekAnchor(addDaysIso(weekAnchor, -7))}
              >
                ← Week
              </button>
              <span className="text-[13px] font-medium text-gray-800">
                Week of{" "}
                {new Date(`${weekAnchor}T12:00:00`).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <button
                type="button"
                className="rounded border border-gray-200 px-2 py-1 text-[12px]"
                onClick={() => setWeekAnchor(addDaysIso(weekAnchor, 7))}
              >
                Week →
              </button>
            </div>
          ) : null}

          {viewMode === "month" ? (
            <div className="hidden md:grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="bg-gray-50 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  {d}
                </div>
              ))}
              {cells.map((iso, i) => (
                <div
                  key={iso || `e-${i}`}
                  onDragOver={(e) => iso && e.preventDefault()}
                  onDrop={(e) => {
                    if (!iso) return;
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/post-id");
                    if (id) run(() => moveContentPost(id, projectId, iso));
                  }}
                  className={`bg-white p-1.5 ${
                    density === "expanded" ? "min-h-[180px]" : "min-h-[108px]"
                  } ${iso ? "" : "bg-gray-50"}`}
                >
                  {iso ? (
                    <>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <button
                          type="button"
                          className="text-[11px] text-gray-400 hover:text-gray-800 hover:underline"
                          title="Open day"
                          onClick={() => setDayDrawerIso(iso)}
                        >
                          {Number(iso.slice(8))}
                        </button>
                        <button
                          type="button"
                          title="Add IG Story"
                          className="text-[9px] font-medium text-slate-500 hover:text-slate-800"
                          onClick={() =>
                            run(async () => {
                              const res = await createContentStory(projectId, {
                                calendarId: calendar.id,
                                scheduled_date: iso,
                              });
                              if (!res.ok) return res;
                              return { ok: true as const };
                            })
                          }
                        >
                          + Story
                        </button>
                      </div>
                      {(() => {
                        const { feed, stories } = splitDayPosts(byDate[iso] || []);
                        return (
                          <div className="space-y-1">
                            {feed.map((p) => (
                              <ContentPostCard
                                key={p.id}
                                post={p}
                                compact
                                density={density}
                                draggable={p.status_production !== "live"}
                                onDragStart={(e) => e.dataTransfer.setData("text/post-id", p.id)}
                                onClick={() => openDrawerFor(p)}
                                onManage={() => openDrawerFor(p)}
                              />
                            ))}
                            {stories.length ? (
                              <div className="space-y-1 border-t border-dashed border-slate-200 pt-1">
                                {stories.map((p) => (
                                  <ContentStoryCard
                                    key={p.id}
                                    post={p}
                                    linkedLabel={
                                      p.linked_post_id
                                        ? postLabel(postNumberById[p.linked_post_id] || 0)
                                        : null
                                    }
                                    draggable={p.status_production !== "live"}
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData("text/post-id", p.id)
                                    }
                                    onClick={() => openDrawerFor(p)}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="hidden md:grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const iso = addDaysIso(weekAnchor, i);
                const inMonth = iso.startsWith(periodStart.slice(0, 7));
                const { feed, stories } = splitDayPosts(byDate[iso] || []);
                return (
                  <div
                    key={iso}
                    className={`rounded-lg border p-2 min-h-[320px] ${
                      inMonth ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/post-id");
                      if (id) run(() => moveContentPost(id, projectId, iso));
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-gray-800 hover:underline"
                        onClick={() => setDayDrawerIso(iso)}
                      >
                        {WEEKDAYS[i]} {Number(iso.slice(8))}
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-slate-500"
                        onClick={() =>
                          run(async () => {
                            const res = await createContentStory(projectId, {
                              calendarId: calendar.id,
                              scheduled_date: iso,
                            });
                            if (!res.ok) return res;
                            return { ok: true as const };
                          })
                        }
                      >
                        + Story
                      </button>
                    </div>
                    <div className="space-y-2">
                      {feed.map((p) => (
                        <ContentPostCard
                          key={p.id}
                          post={p}
                          density="expanded"
                          draggable={p.status_production !== "live"}
                          onDragStart={(e) => e.dataTransfer.setData("text/post-id", p.id)}
                          onClick={() => openDrawerFor(p)}
                          onManage={() => openDrawerFor(p)}
                        />
                      ))}
                      {stories.map((p) => (
                        <ContentStoryCard
                          key={p.id}
                          post={p}
                          linkedLabel={
                            p.linked_post_id
                              ? postLabel(postNumberById[p.linked_post_id] || 0)
                              : null
                          }
                          onClick={() => openDrawerFor(p)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="md:hidden space-y-2">
            {(viewMode === "week"
              ? Array.from({ length: 7 }, (_, i) => addDaysIso(weekAnchor, i))
              : cells.filter((iso): iso is string => Boolean(iso))
            ).map((iso) => {
              const dayPosts = byDate[iso] || [];
              if (viewMode === "month" && !dayPosts.length) return null;
              return (
                <div
                  key={iso}
                  className="rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-800"
                      onClick={() => setDayDrawerIso(iso)}
                    >
                      {new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const { feed, stories } = splitDayPosts(dayPosts);
                      return (
                        <>
                          {feed.map((p) => (
                            <ContentPostCard
                              key={p.id}
                              post={p}
                              density={density}
                              onClick={() => openDrawerFor(p)}
                              onManage={() => openDrawerFor(p)}
                            />
                          ))}
                          {stories.length ? (
                            <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Stories
                              </div>
                              {stories.map((p) => (
                                <ContentStoryCard
                                  key={p.id}
                                  post={p}
                                  linkedLabel={
                                    p.linked_post_id
                                      ? postLabel(postNumberById[p.linked_post_id] || 0)
                                      : null
                                  }
                                  onClick={() => openDrawerFor(p)}
                                />
                              ))}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                            onClick={() =>
                              run(async () => {
                                const res = await createContentStory(projectId, {
                                  calendarId: calendar.id,
                                  scheduled_date: iso,
                                });
                                if (!res.ok) return res;
                                return { ok: true as const };
                              })
                            }
                          >
                            + Add Story
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {dayDrawerIso ? (
            <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
              <button
                type="button"
                className="flex-1 cursor-default"
                aria-label="Close day"
                onClick={() => setDayDrawerIso(null)}
              />
              <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Day</div>
                    <div className="text-[15px] font-semibold text-gray-900">
                      {new Date(`${dayDrawerIso}T12:00:00`).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-gray-200 px-2.5 py-1 text-[12px]"
                    onClick={() => setDayDrawerIso(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-3 p-4">
                  {(() => {
                    const { feed, stories } = splitDayPosts(byDate[dayDrawerIso] || []);
                    if (!feed.length && !stories.length) {
                      return <p className="text-[13px] text-gray-500">No posts this day.</p>;
                    }
                    return (
                      <>
                        {feed.map((p) => (
                          <ContentPostCard
                            key={p.id}
                            post={p}
                            density="expanded"
                            onClick={() => {
                              setDayDrawerIso(null);
                              openDrawerFor(p);
                            }}
                            onManage={() => {
                              setDayDrawerIso(null);
                              openDrawerFor(p);
                            }}
                          />
                        ))}
                        {stories.map((p) => (
                          <ContentStoryCard
                            key={p.id}
                            post={p}
                            linkedLabel={
                              p.linked_post_id
                                ? postLabel(postNumberById[p.linked_post_id] || 0)
                                : null
                            }
                            onClick={() => {
                              setDayDrawerIso(null);
                              openDrawerFor(p);
                            }}
                          />
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {panel === "settings" ? (
        <div className="max-w-2xl space-y-4">
          <p className="text-[13px] text-gray-600">
            Per-project voice and cadence. Pillars and languages are open lists — not a global catalog.
          </p>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              Pillars (comma-separated)
            </span>
            <input
              value={pillars}
              onChange={(e) => setPillars(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                Generation languages
              </span>
              <input
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                Languages shown to client
              </span>
              <input
                value={clientLangs}
                onChange={(e) => setClientLangs(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
              />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                LinkedIn posts / week
              </span>
              <input
                type="number"
                min={0}
                max={14}
                value={liCadence}
                onChange={(e) => setLiCadence(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                Instagram posts / week
              </span>
              <input
                type="number"
                min={0}
                max={14}
                value={igCadence}
                onChange={(e) => setIgCadence(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">LinkedIn persona</span>
            <textarea
              value={liPersona}
              onChange={(e) => setLiPersona(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">Instagram persona</span>
            <textarea
              value={igPersona}
              onChange={(e) => setIgPersona(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
            />
          </label>

          <SocialKitAdminPanel
            projectId={projectId}
            initial={settings.social_assets}
            onMsg={(m) => setMsg(m)}
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveContentSettings(projectId, {
                      pillars: pillars.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
                      languages: languages.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
                      client_languages: clientLangs
                        .split(",")
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean),
                      platform_personas: { linkedin: liPersona, instagram: igPersona },
                      cadence: {
                        linkedin: Number(liCadence) || 0,
                        instagram: Number(igCadence) || 0,
                      },
                    }),
                  "Settings saved"
                )
              }
              className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-[13px]"
            >
              Save settings
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => seedPersonasFromCi(projectId), "Seeded from CI Builder")}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-[13px]"
            >
              Seed personas from CI
            </button>
          </div>
        </div>
      ) : null}

      {panel === "context" ? (
        <div className="max-w-2xl space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">Prompt budget</span>
              <span className={`text-[12px] ${context.truncated ? "text-amber-700" : "text-gray-500"}`}>
                {context.chars.toLocaleString()} / {CONTEXT_HARD_LIMIT.toLocaleString()} chars
                {context.chars > CONTEXT_SOFT_LIMIT ? " · large" : ""}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full ${context.truncated ? "bg-amber-600" : "bg-gray-900"}`}
                style={{ width: `${ctxPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Synced from CI Builder
            </div>
            {context.ci ? (
              <p className="mt-1 text-[13px] text-gray-700">
                {context.ci.label}
                {context.ci.slug ? ` · ${context.ci.slug}` : ""} · {context.ci.chars.toLocaleString()} chars
                {context.ci.status ? ` · ${context.ci.status}` : ""}
                <span className="block text-[12px] text-gray-500 mt-1">Read-only. Edit in CI Builder.</span>
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-gray-500">
                No brand guideline linked to this project yet.
              </p>
            )}
          </div>

          <ContextDocsPanel projectId={projectId} docs={docs} />
        </div>
      ) : null}

      {pending || busyGen ? (
        <div className="fixed bottom-4 right-4 rounded-md bg-gray-900 text-white px-3 py-2 text-[12px] inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {busyGen === "full" ? "Writing captions…" : busyGen === "angles" ? "Planning month…" : "Saving…"}
        </div>
      ) : null}

      {openPost ? (
        <PostDrawer
          post={openPost}
          settings={settings}
          comments={commentsByPost[openPost.id] || []}
          brand={clientLabel || title}
          brandAvatarUrl={brandAvatarUrl}
          calendarPosts={posts}
          calendarId={calendar.id}
          onClose={() => setOpenId(null)}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </ProjectPmShell>
  );
}
