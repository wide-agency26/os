"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Unlock, Trash2 } from "lucide-react";
import {
  addStaffComment,
  createContentStory,
  deleteContentPost,
  resolveComment,
  setPostApproval,
  setPostProduction,
  unlockPost,
  updateContentPost,
} from "@/app/actions/content-calendar";
import {
  APPROVAL_LABEL,
  captionForLang,
  captionsWithHashtags,
  postLabel,
  setCaptionForLang,
  type ApprovalStatus,
  type ContentComment,
  type ContentPost,
  type ContentSettings,
  type ProductionStatus,
} from "@/lib/content/types";
import { formatSpecForPost, type ContentVisualFormat } from "@/lib/content/formats";
import { coverUrlFromMedia, resolvePostMedia } from "@/lib/content/media";
import { CaptionPreview, PlatformIcon } from "./PlatformMockups";
import { PostMediaPanel } from "./PostMediaPanel";

const APPROVALS: ApprovalStatus[] = [
  "draft",
  "needs_review",
  "approved",
  "on_hold",
  "needs_revision",
];

const STICKER_OPTIONS = [
  "poll",
  "question",
  "link",
  "dm",
  "countdown",
  "slider",
  "none",
] as const;

export function PostDrawer({
  post,
  settings,
  comments,
  brand,
  brandAvatarUrl,
  calendarPosts = [],
  calendarId,
  onClose,
  onChanged,
}: {
  post: ContentPost;
  settings: ContentSettings;
  comments: ContentComment[];
  brand: string;
  brandAvatarUrl?: string | null;
  /** Same-calendar posts for Story ↔ feed linking. */
  calendarPosts?: ContentPost[];
  calendarId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isStory = post.visual_format === "story";
  const [tab, setTab] = useState<"copy" | "preview" | "media" | "brief" | "comments">(
    post.status_production === "live" ? "media" : "copy"
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [hook, setHook] = useState(post.hook_angle || "");
  const [pillar, setPillar] = useState(post.pillar || settings.pillars[0] || "");
  const [remarks, setRemarks] = useState(post.remarks || "");
  const [teamReshare, setTeamReshare] = useState<Record<string, string>>(
    () => post.team_reshare_captions || {}
  );
  const [asset, setAsset] = useState(post.visual_asset_url || "");
  const [captions, setCaptions] = useState(() => captionsWithHashtags(post));
  const [format, setFormat] = useState<ContentVisualFormat>(
    post.visual_format === "story"
      ? "story"
      : post.visual_format === "reel" || post.is_video || post.media_kind === "video"
        ? "reel"
        : "feed"
  );
  const [bg, setBg] = useState(post.visual_brief.background || "");
  const [graphic, setGraphic] = useState(post.visual_brief.graphic_description || "");
  const [style, setStyle] = useState(post.visual_brief.style_notes || "");
  const [anim, setAnim] = useState(post.visual_brief.animation_mechanics || "");
  const [type, setType] = useState(post.visual_brief.typography_notes || "");
  const [story, setStory] = useState(post.story_repost?.strategy_text || "");
  const [sticker, setSticker] = useState(post.story_repost?.sticker_type || "");
  const [storyLinkUrl, setStoryLinkUrl] = useState(post.story_repost?.link_url || "");
  const [storyLinkLabel, setStoryLinkLabel] = useState(post.story_repost?.link_label || "");
  const [storyStickers, setStoryStickers] = useState<string[]>(
    () =>
      post.story_repost?.stickers ||
      (post.story_repost?.sticker_type && post.story_repost.sticker_type !== "none"
        ? [post.story_repost.sticker_type]
        : [])
  );
  const [ctaHint, setCtaHint] = useState(post.story_repost?.cta_hint || "");
  const [musicHint, setMusicHint] = useState(post.story_repost?.music_hint || "");
  const [frameNotes, setFrameNotes] = useState(post.story_repost?.frame_notes || "");
  const [linkedPostId, setLinkedPostId] = useState(post.linked_post_id || "");
  const [comment, setComment] = useState("");
  const langs = settings.languages.length ? settings.languages : ["en"];
  const platforms = post.platforms.length ? post.platforms : ["linkedin", "instagram"];
  const isLinkedIn = platforms.includes("linkedin");
  const fmtSpec = formatSpecForPost({
    platforms,
    visual_format: format,
    is_video: post.is_video,
    media_kind: post.media_kind,
  });
  const isLive = post.status_production === "live";
  const mediaSlides = resolvePostMedia(post);
  const cover = coverUrlFromMedia(mediaSlides) || asset || post.visual_asset_url;

  const linkablePosts = calendarPosts.filter(
    (p) => p.id !== post.id && p.visual_format !== "story"
  );

  function buildStoryRepost() {
    if (!story.trim() && !isStory) return null;
    return {
      strategy_text: story,
      sticker_type: sticker || storyStickers[0] || "none",
      ...(storyLinkUrl ? { link_url: storyLinkUrl } : {}),
      ...(storyLinkLabel ? { link_label: storyLinkLabel } : {}),
      ...(storyStickers.length ? { stickers: storyStickers } : {}),
      ...(ctaHint ? { cta_hint: ctaHint } : {}),
      ...(musicHint ? { music_hint: musicHint } : { music_hint: null }),
      ...(frameNotes ? { frame_notes: frameNotes } : {}),
    };
  }

  function toggleSticker(s: string) {
    setStoryStickers((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      if (!sticker || sticker === "none") setSticker(next[0] || "none");
      return next;
    });
  }

  const busy = pending;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) setMsg(res.error || "Failed");
      else {
        if (okMsg) setMsg(okMsg);
        onChanged();
        router.refresh();
      }
    });
  }

  async function generate(step: "post_angle" | "post_full") {
    setMsg(null);
    start(async () => {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          projectId: post.project_id,
          postId: post.id,
        }),
      });
      const json = await res.json();
      if (!json.ok) setMsg(json.error || "Generation failed");
      else {
        setMsg(step === "post_angle" ? "Angle regenerated" : "Copy regenerated");
        onChanged();
        router.refresh();
      }
    });
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    rows = 3
  ) => (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[13px] text-gray-800"
      />
    </label>
  );

  const tabs = isLive
    ? (["media", "preview", "comments"] as const)
    : (["copy", "media", "preview", "brief", "comments"] as const);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl bg-white shadow-xl border-l border-gray-200 overflow-y-auto pb-[var(--os-bottom-nav)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                {postLabel(post.post_number)} · {post.scheduled_date}
                {isLive ? " · Posted" : ""}
              </div>
              <h2 className="text-[15px] font-semibold text-gray-900 mt-0.5">
                {post.hook_angle || "Untitled angle"}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {post.platforms.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700"
                  >
                    <PlatformIcon platform={p} className="w-3 h-3" />
                    {p}
                  </span>
                ))}
                {post.pillar ? (
                  <span className="rounded bg-gray-900 text-white px-1.5 py-0.5 text-[10px] font-medium">
                    {post.pillar}
                  </span>
                ) : null}
                <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {fmtSpec.shortLabel}
                </span>
                <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 capitalize">
                  {post.media_kind || "image"}
                </span>
                {isLive || post.locked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                    <Lock className="w-3 h-3" /> {isLive ? "Posted" : "Locked"}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] text-gray-500 hover:text-gray-900"
            >
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 rounded-md text-[12px] capitalize ${
                  tab === t ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {msg ? (
            <p className="text-[12px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
              {msg}
            </p>
          ) : null}

          {isLive ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-3 space-y-2">
              <p className="text-[13px] text-emerald-950">
                This post is Live. Copy is locked — update published links or refresh the thumb in
                Media.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => setPostProduction(post.id, post.project_id, "wip"),
                    "Reverted to WIP"
                  )
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px]"
              >
                Revert to WIP
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!isLive ? (
              <select
                value={post.status_approval}
                onChange={(e) =>
                  run(() =>
                    setPostApproval(post.id, post.project_id, e.target.value as ApprovalStatus)
                  )
                }
                className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
              >
                {APPROVALS.map((s) => (
                  <option key={s} value={s}>
                    {APPROVAL_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={post.status_production}
              onChange={(e) =>
                run(() =>
                  setPostProduction(post.id, post.project_id, e.target.value as ProductionStatus)
                )
              }
              className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
            >
              <option value="wip">WIP</option>
              <option value="live">Live (posted)</option>
            </select>
            {!isLive ? (
              <>
                <select
                  value={post.ad_status}
                  onChange={(e) =>
                    run(() =>
                      updateContentPost(post.id, post.project_id, { ad_status: e.target.value })
                    )
                  }
                  className="rounded-md border border-gray-200 text-[12px] px-2 py-1.5"
                >
                  <option value="organic">Organic</option>
                  <option value="paid">Paid</option>
                </select>
                {post.locked ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => unlockPost(post.id, post.project_id), "Unlocked")}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-[12px]"
                  >
                    <Unlock className="w-3 h-3" /> Unlock
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || post.locked}
                  onClick={() => void generate("post_angle")}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-[12px] disabled:opacity-50"
                >
                  Regen angle
                </button>
                <button
                  type="button"
                  disabled={busy || post.locked || !post.angle_approved}
                  onClick={() => void generate("post_full")}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-[12px] disabled:opacity-50"
                  title={!post.angle_approved ? "Approve the angle first" : undefined}
                >
                  Regen copy
                </button>
              </>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Delete ${postLabel(post.post_number)}?`)) return;
                run(() => deleteContentPost(post.id, post.project_id));
                onClose();
              }}
              className="ml-auto inline-flex items-center gap-1 text-[12px] text-red-700"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {!isLive ? (
            <p className="text-[12px] text-gray-500">
              Upload creatives and published links in the{" "}
              <button
                type="button"
                className="font-medium text-gray-800 underline"
                onClick={() => setTab("media")}
              >
                Media
              </button>{" "}
              tab.
            </p>
          ) : null}

          {tab === "copy" && !isLive ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Pillar
                </span>
                <select
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
                >
                  {settings.pillars.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {field("Hook / angle", hook, setHook, 2)}
              <div
                className="w-full overflow-hidden rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 relative"
                style={{ aspectRatio: fmtSpec.aspectCss, maxHeight: 160 }}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                    <span className="text-[11px] font-semibold text-gray-600">
                      Set visuals in Media
                    </span>
                    <span className="text-[11px] text-gray-400">{fmtSpec.shortLabel}</span>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-gray-700">
                <input
                  type="checkbox"
                  checked={post.angle_approved}
                  onChange={(e) =>
                    run(() =>
                      updateContentPost(post.id, post.project_id, {
                        angle_approved: e.target.checked,
                      })
                    )
                  }
                />
                Angle approved — ready for full copy
              </label>
              {langs.map((lang) => (
                <div key={lang} className="space-y-2 rounded-md border border-gray-100 p-2.5">
                  {field(
                    `Caption ${lang.toUpperCase()}`,
                    captionForLang(captions, platforms, lang),
                    (v) => setCaptions(setCaptionForLang(captions, platforms, lang, v)),
                    8
                  )}
                </div>
              ))}
              {isLinkedIn ? (
                <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/40 p-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-blue-600">
                    Team #sign2x reshare (LinkedIn)
                  </p>
                  <p className="text-[12px] text-gray-500">
                    Short personal caption colleagues use when resharing this company post.
                  </p>
                  {langs.map((lang) => (
                    <div key={`team-${lang}`}>
                      {field(
                        `Team reshare ${lang.toUpperCase()}`,
                        teamReshare[lang] || "",
                        (v) => setTeamReshare({ ...teamReshare, [lang]: v }),
                        4
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {field("Visual", graphic, setGraphic, 3)}
              {field("Visual background / style", bg, setBg, 2)}

              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                  {isStory ? "Story plan" : "Companion Story note"}
                </p>
                {isStory ? (
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Link to feed post (optional)
                    </span>
                    <select
                      value={linkedPostId}
                      onChange={(e) => setLinkedPostId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
                    >
                      <option value="">Standalone</option>
                      {linkablePosts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {postLabel(p.post_number)} · {p.scheduled_date} ·{" "}
                          {(p.hook_angle || "").slice(0, 48)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {field(
                  isStory ? "Strategy / what to say" : "Story repost note",
                  story,
                  setStory,
                  3
                )}
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Suggested stickers
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {STICKER_OPTIONS.filter((s) => s !== "none").map((s) => (
                      <label
                        key={s}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${
                          storyStickers.includes(s)
                            ? "border-slate-800 bg-slate-800 text-white"
                            : "border-gray-200 bg-white text-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={storyStickers.includes(s)}
                          onChange={() => toggleSticker(s)}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Primary sticker
                  </span>
                  <select
                    value={sticker}
                    onChange={(e) => setSticker(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
                  >
                    {STICKER_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Link URL
                  </span>
                  <input
                    value={storyLinkUrl}
                    onChange={(e) => setStoryLinkUrl(e.target.value)}
                    placeholder="https://www.sign2x.com/quiz"
                    className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Link label
                  </span>
                  <input
                    value={storyLinkLabel}
                    onChange={(e) => setStoryLinkLabel(e.target.value)}
                    placeholder="Quiz · 2 Min"
                    className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
                  />
                </label>
                {field("CTA hint", ctaHint, setCtaHint, 2)}
                {field("Frame notes", frameNotes, setFrameNotes, 2)}
                {field("Music hint (optional)", musicHint, setMusicHint, 1)}
              </div>

              {!isStory && calendarId && !isLive ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const res = await createContentStory(post.project_id, {
                        calendarId,
                        scheduled_date: post.scheduled_date,
                        linked_post_id: post.id,
                        hook_angle: `Story · ${post.hook_angle || postLabel(post.post_number)}`,
                        story_repost: {
                          strategy_text: story || "Share feed still → link sticker",
                          sticker_type: sticker || "link",
                          stickers: storyStickers.length ? storyStickers : ["link"],
                          link_url: storyLinkUrl || "https://www.sign2x.com/quiz",
                          cta_hint: ctaHint || "Link sticker to quiz / site",
                          frame_notes: frameNotes || "Crop feed still or 9:16 companion",
                        },
                        pillar: post.pillar,
                      });
                      if (!res.ok) return res;
                      setMsg(`Created Story ${postLabel(res.post_number)}`);
                      return { ok: true as const };
                    })
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-800"
                >
                  Add linked Story
                </button>
              ) : null}

              {field("Internal / external notes", remarks, setRemarks, 3)}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      updateContentPost(post.id, post.project_id, {
                        hook_angle: hook,
                        pillar,
                        remarks,
                        captions,
                        hashtags: {},
                        team_reshare_captions: isLinkedIn ? teamReshare : {},
                        visual_brief: {
                          background: bg,
                          graphic_description: graphic,
                          style_notes: style,
                          animation_mechanics: anim,
                          typography_notes: type,
                        },
                        story_repost: buildStoryRepost(),
                        ...(isStory
                          ? { linked_post_id: linkedPostId || null, visual_format: "story" }
                          : {}),
                      }),
                    "Saved"
                  )
                }
                className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-[13px] disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          ) : null}

          {tab === "media" ? (
            <PostMediaPanel
              post={post}
              onChanged={() => {
                onChanged();
                router.refresh();
              }}
            />
          ) : null}

          {tab === "preview" ? (
            <CaptionPreview
              captions={captions}
              languages={langs}
              brand={brand}
              avatarUrl={brandAvatarUrl}
              mediaKind={post.media_kind}
              instagramSlides={resolvePostMedia(post, "instagram").map(
                (m) => m.poster_url || m.url
              )}
              linkedinSlides={resolvePostMedia(post, "linkedin").map(
                (m) => m.poster_url || m.url
              )}
              visualFormat={format}
              isVideo={post.is_video || post.media_kind === "video"}
            />
          ) : null}

          {tab === "brief" && !isLive ? (
            <div className="space-y-3">
              {field("Visual (graphic)", graphic, setGraphic)}
              {field("Background", bg, setBg)}
              {field("Style notes", style, setStyle)}
              <p className="text-[12px] text-gray-500">
                Upload creatives in the Media tab. Optional paste URL below still works as a single
                cover.
              </p>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Finished asset URL
                </span>
                <input
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      updateContentPost(post.id, post.project_id, {
                        visual_brief: {
                          background: bg,
                          graphic_description: graphic,
                          style_notes: style,
                          animation_mechanics: anim,
                          typography_notes: type,
                        },
                        visual_asset_url: asset || null,
                        story_repost: buildStoryRepost(),
                        ...(isStory
                          ? { linked_post_id: linkedPostId || null, visual_format: "story" }
                          : {}),
                      }),
                    "Brief saved"
                  )
                }
                className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-[13px]"
              >
                Save brief
              </button>
            </div>
          ) : null}

          {tab === "comments" ? (
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-[13px] text-gray-500">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-md border border-gray-100 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-gray-900">{c.author_name}</span>
                      <button
                        type="button"
                        className="text-[11px] text-gray-500"
                        onClick={() =>
                          run(() => resolveComment(c.id, post.project_id, !c.resolved))
                        }
                      >
                        {c.resolved ? "Reopen" : "Resolve"}
                      </button>
                    </div>
                    <p
                      className={`mt-1 text-[13px] ${
                        c.resolved ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {c.body}
                    </p>
                  </div>
                ))
              )}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
              />
              <button
                type="button"
                disabled={busy || !comment.trim()}
                onClick={() => {
                  const body = comment.trim();
                  setComment("");
                  run(() => addStaffComment(post.id, post.project_id, body));
                }}
                className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-[13px] disabled:opacity-50"
              >
                Add comment
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
