"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addClientComment } from "@/app/actions/content-calendar";
import {
  APPROVAL_LABEL,
  monthLabel,
  postLabel,
  shiftMonth,
  type ContentComment,
  type ContentPost,
  type ContentSettings,
} from "@/lib/content/types";
import {
  contentToday,
  isMissedPost,
  isPastScheduledDate,
  showOnPastDayGrid,
} from "@/lib/content/calendar-day";
import { isValidIgPermalink } from "@/lib/reports/instagram-organic";
import { CaptionPreview } from "./PlatformMockups";
import {
  ClientEmptyState,
  ClientPortalFrame,
  ClientProjectSwitcher,
} from "@/components/client/ClientPortalFrame";
import { ContentPostCard } from "./ContentPostCard";
import { ContentStoryCard } from "./ContentStoryCard";
import { captionsWithHashtags } from "@/lib/content/types";
import { isStoryPost, formatSpecForPost } from "@/lib/content/formats";
import { coverUrlFromMedia, isValidLinkedInPostUrl, resolvePostMedia } from "@/lib/content/media";
import { ExternalLink } from "lucide-react";
import { ClientLinkedInKitPanel } from "@/components/content/ClientLinkedInKitPanel";

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

export function ClientContentView({
  projectId,
  projectTitle,
  brandAvatarUrl,
  periodStart,
  settings,
  posts,
  comments,
  months,
  projects,
}: {
  projectId: string;
  projectTitle: string;
  brandAvatarUrl?: string | null;
  periodStart: string;
  settings: ContentSettings;
  posts: ContentPost[];
  comments: ContentComment[];
  months: string[];
  projects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pillar, setPillar] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const langs = settings.client_languages.length
    ? settings.client_languages
    : settings.languages;
  const open = posts.find((p) => p.id === openId) || null;

  const visible = posts.filter((p) => {
    if (pillar && p.pillar !== pillar) return false;
    const today = contentToday();
    if (isMissedPost(p, today)) return false;
    if (isPastScheduledDate(p.scheduled_date, today) && !showOnPastDayGrid(p)) return false;
    return true;
  });
  const byDate = useMemo(() => {
    const m: Record<string, ContentPost[]> = {};
    for (const p of visible) (m[p.scheduled_date] ||= []).push(p);
    return m;
  }, [visible]);

  function openClientPost(p: ContentPost) {
    const ig = p.published_links?.instagram || p.published_permalink;
    const li = p.published_links?.linkedin;
    if (p.status_production === "live" && isValidIgPermalink(ig)) {
      window.open(ig!, "_blank", "noopener,noreferrer");
      return;
    }
    if (p.status_production === "live" && isValidLinkedInPostUrl(li)) {
      window.open(li!, "_blank", "noopener,noreferrer");
      return;
    }
    // Live without a hard permalink still deep-links to the channel hub.
    if (p.status_production === "live" && p.platforms.includes("instagram")) {
      window.open("https://www.instagram.com/sign2x.de/", "_blank", "noopener,noreferrer");
      return;
    }
    if (p.status_production === "live" && p.platforms.includes("linkedin")) {
      window.open("https://www.linkedin.com/company/sign2x/", "_blank", "noopener,noreferrer");
      return;
    }
    setOpenId(p.id);
  }

  const cells = daysInMonth(periodStart);
  const postComments = comments.filter((c) => c.post_id === openId);

  const scorecard = useMemo(() => {
    const feed = posts.filter((p) => !isStoryPost(p));
    const produced = feed.filter(
      (p) =>
        p.status_approval !== "on_hold" &&
        (resolvePostMedia(p).length > 0 || Boolean(p.visual_asset_url))
    ).length;
    const live = feed.filter((p) => p.status_production === "live").length;
    const awaiting = feed.filter(
      (p) =>
        p.status_production !== "live" &&
        (p.status_approval === "needs_review" || p.status_approval === "needs_revision")
    ).length;
    return { produced, live, awaiting, total: feed.length };
  }, [posts]);

  function go(delta: number) {
    const next = shiftMonth(periodStart, delta);
    router.push(`/app/client-content?project=${projectId}&month=${next}`);
  }

  return (
    <ClientPortalFrame
      eyebrow="Content"
      title={projectTitle}
      subtitle="Shared posts for review this month."
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <ClientProjectSwitcher
            projects={projects}
            projectId={projectId}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => go(-1)}
              className="p-2 min-h-11 min-w-11 rounded-md hover:bg-surface-raised text-text-secondary"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-medium text-text-primary min-w-[7.5rem] text-center">
              {monthLabel(periodStart)}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              className="p-2 min-h-11 min-w-11 rounded-md hover:bg-surface-raised text-text-secondary"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {months.length > 1
            ? months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    router.push(`/app/client-content?project=${projectId}&month=${m}`)
                  }
                  className={`px-2.5 py-2 min-h-11 rounded-md text-[12px] ${
                    m === periodStart
                      ? "bg-accent text-white"
                      : "border border-border text-text-secondary"
                  }`}
                >
                  {monthLabel(m)}
                </button>
              ))
            : null}
          <select
            value={pillar}
            onChange={(e) => setPillar(e.target.value)}
            className="rounded-lg border border-border bg-surface text-[13px] px-3 py-2.5 min-h-11 outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All pillars</option>
            {settings.pillars.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      }
    >
        {posts.filter((p) => !isStoryPost(p)).length > 0 ? (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-[11px] text-text-muted leading-snug">Produced</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
                {scorecard.produced}
              </p>
              <p className="mt-1 text-[11px] text-text-secondary">
                Creatives ready this month
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-[11px] text-text-muted leading-snug">Live</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
                {scorecard.live}
              </p>
              <p className="mt-1 text-[11px] text-text-secondary">
                Posted on Instagram / LinkedIn
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3 col-span-2 sm:col-span-1">
              <p className="text-[11px] text-text-muted leading-snug">Awaiting confirmation</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
                {scorecard.awaiting}
              </p>
              <p className="mt-1 text-[11px] text-text-secondary">
                Shared for your review
              </p>
            </div>
          </div>
        ) : null}

        <ClientLinkedInKitPanel socialAssets={settings.social_assets} />

        {visible.length === 0 ? (
          <ClientEmptyState
            title="Nothing shared for this month"
            message="Your account manager will publish the calendar here when it is ready for review."
          />
        ) : (
          <>
          <div className="hidden md:grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="bg-surface-raised px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              >
                {d}
              </div>
            ))}
            {cells.map((iso, i) => (
              <div key={iso || `e-${i}`} className={`min-h-[96px] bg-surface p-1.5 ${iso ? "" : "bg-surface-raised"}`}>
                {iso ? (
                  <>
                    <div className="text-[11px] text-text-muted mb-1">{Number(iso.slice(8))}</div>
                    <div className="space-y-1">
                      {(byDate[iso] || [])
                        .filter((p) => !isStoryPost(p))
                        .map((p) => (
                          <ContentPostCard
                            key={p.id}
                            post={p}
                            compact
                            onClick={() => openClientPost(p)}
                          />
                        ))}
                      {(byDate[iso] || []).some(isStoryPost) ? (
                        <div className="space-y-1 border-t border-dashed border-border pt-1">
                          {(byDate[iso] || [])
                            .filter(isStoryPost)
                            .map((p) => (
                              <ContentStoryCard
                                key={p.id}
                                post={p}
                                onClick={() => openClientPost(p)}
                              />
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <div className="md:hidden space-y-2">
            {cells.filter((iso): iso is string => Boolean(iso)).map((iso) => {
              const dayPosts = byDate[iso] || [];
              if (!dayPosts.length) return null;
              return (
                <div key={iso} className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                    {new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div className="space-y-2">
                    {dayPosts
                      .filter((p) => !isStoryPost(p))
                      .map((p) => (
                        <ContentPostCard
                          key={p.id}
                          post={p}
                          onClick={() => openClientPost(p)}
                        />
                      ))}
                    {dayPosts.some(isStoryPost) ? (
                      <div className="space-y-1.5 border-t border-dashed border-border pt-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                          Stories
                        </div>
                        {dayPosts.filter(isStoryPost).map((p) => (
                          <ContentStoryCard
                            key={p.id}
                            post={p}
                            onClick={() => openClientPost(p)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}

      {open ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/20" onClick={() => setOpenId(null)}>
          <aside
            className="h-full w-full max-w-xl bg-surface shadow-xl overflow-y-auto pb-[var(--os-bottom-nav)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border sticky top-0 bg-surface">
              <div className="text-[11px] uppercase tracking-wide text-text-muted">
                {postLabel(open.post_number)} · {open.scheduled_date}
              </div>
              <h2 className="text-[16px] font-semibold text-text-primary mt-0.5">{open.hook_angle}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
                {open.pillar ? <span className="font-medium">{open.pillar}</span> : null}
                <span>{formatSpecForPost(open).shortLabel}</span>
                <span className="capitalize">{open.media_kind || "image"}</span>
                <span>{APPROVAL_LABEL[open.status_approval]}</span>
              </div>
            </div>
            <div className="p-4 space-y-5">
              {open.status_production === "live" &&
              isValidIgPermalink(open.published_links?.instagram || open.published_permalink) ? (
                <a
                  href={(open.published_links?.instagram || open.published_permalink)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-800 text-white px-3 py-2 text-[13px]"
                >
                  Open on Instagram <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
              {open.status_production === "live" &&
              isValidLinkedInPostUrl(open.published_links?.linkedin) ? (
                <a
                  href={open.published_links!.linkedin!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0A66C2] text-white px-3 py-2 text-[13px]"
                >
                  Open on LinkedIn <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
              <CaptionPreview
                captions={captionsWithHashtags(open)}
                languages={langs}
                brand={projectTitle}
                avatarUrl={brandAvatarUrl}
                mediaKind={open.media_kind}
                instagramSlides={resolvePostMedia(open, "instagram").map(
                  (m) => m.poster_url || m.url
                )}
                linkedinSlides={resolvePostMedia(open, "linkedin").map(
                  (m) => m.poster_url || m.url
                )}
                visualFormat={
                  open.visual_format === "story"
                    ? "story"
                    : open.visual_format === "reel" || open.media_kind === "video"
                      ? "reel"
                      : "feed"
                }
                isVideo={open.is_video || open.media_kind === "video"}
              />
              {open.visual_format === "story" ? (
                <div className="rounded-md border border-border p-3 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    IG Story
                    {open.linked_post_id ? " · linked" : " · standalone"}
                  </div>
                  {open.story_repost?.strategy_text ? (
                    <p className="text-[13px] text-text-primary">{open.story_repost.strategy_text}</p>
                  ) : null}
                  {(open.story_repost?.stickers || []).length ? (
                    <p className="text-[12px] text-text-muted">
                      Stickers: {(open.story_repost?.stickers || []).join(", ")}
                    </p>
                  ) : open.story_repost?.sticker_type ? (
                    <p className="text-[12px] text-text-muted">
                      Sticker: {open.story_repost.sticker_type}
                    </p>
                  ) : null}
                  {open.story_repost?.link_url ? (
                    <p className="text-[12px] text-text-muted">Link: {open.story_repost.link_url}</p>
                  ) : null}
                </div>
              ) : open.story_repost?.strategy_text ? (
                <div className="rounded-md border border-border p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Story with this post
                  </div>
                  <p className="mt-1 text-[13px] text-text-primary">{open.story_repost.strategy_text}</p>
                  {open.story_repost.sticker_type && open.story_repost.sticker_type !== "none" ? (
                    <p className="text-[12px] text-text-muted mt-1">
                      Sticker: {open.story_repost.sticker_type}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {open.is_video || open.visual_format === "reel" ? (
                (open.visual_brief.first_frame ||
                  open.visual_brief.last_frame ||
                  open.visual_brief.video_prompt) ? (
                  <div className="rounded-md border border-border p-3 text-[13px] text-text-secondary space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      Video brief
                    </div>
                    {open.visual_brief.first_frame ? (
                      <p>
                        <span className="font-medium text-text-primary">First frame:</span>{" "}
                        {open.visual_brief.first_frame}
                      </p>
                    ) : null}
                    {open.visual_brief.last_frame ? (
                      <p>
                        <span className="font-medium text-text-primary">Last frame:</span>{" "}
                        {open.visual_brief.last_frame}
                      </p>
                    ) : null}
                    {open.visual_brief.video_prompt ? (
                      <p>
                        <span className="font-medium text-text-primary">Video prompt:</span>{" "}
                        {open.visual_brief.video_prompt}
                      </p>
                    ) : null}
                  </div>
                ) : null
              ) : (open.visual_brief.background || open.visual_brief.graphic_description) ? (
                <div className="rounded-md border border-border p-3 text-[13px] text-text-secondary space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Visual
                  </div>
                  {open.visual_brief.background ? <p>BG: {open.visual_brief.background}</p> : null}
                  {open.visual_brief.graphic_description ? (
                    <p>{open.visual_brief.graphic_description}</p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                  Comments
                </div>
                {postComments.length === 0 ? (
                  <p className="text-[13px] text-text-muted">No comments yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {postComments.map((c) => (
                      <li key={c.id} className="rounded-md border border-border p-2.5">
                        <div className="text-[12px] font-medium text-text-primary">{c.author_name}</div>
                        <p className="text-[13px] text-text-secondary mt-0.5">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {msg ? <p className="text-[12px] text-text-secondary mt-2">{msg}</p> : null}
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder="Leave a comment for the WIDE team"
                  className="mt-3 w-full rounded-lg border border-border px-2.5 py-2 text-[13px] bg-surface outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  disabled={pending || !draft.trim()}
                  onClick={() => {
                    const body = draft.trim();
                    setDraft("");
                    start(async () => {
                      const res = await addClientComment(open.id, projectId, body);
                      setMsg(res.ok ? "Comment sent" : res.error || "Could not send");
                      if (res.ok) router.refresh();
                    });
                  }}
                  className="mt-2 rounded-md bg-accent text-white px-3 py-2.5 min-h-11 text-[13px] disabled:opacity-50"
                >
                  Send comment
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </ClientPortalFrame>
  );
}
