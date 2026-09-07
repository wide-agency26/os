"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  GripVertical,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  commitContentMedia,
  listProjectContentMedia,
  prepareContentMediaUpload,
  refreshLiveThumbnails,
  removeContentMedia,
  setPostMedia,
  setPostMediaFromReuse,
  updatePublishedLinks,
} from "@/app/actions/content-calendar";
import {
  coverUrlFromMedia,
  resolvePostMedia,
} from "@/lib/content/media";
import {
  VISUAL_FORMAT_SPECS,
  FEED_UPLOAD_HINT,
  formatSpecForPost,
  type ContentVisualFormat,
} from "@/lib/content/formats";
import type {
  ContentMediaItem,
  ContentMediaKind,
  ContentPlatform,
  ContentPost,
  PublishedLinks,
} from "@/lib/content/types";
import { postLabel } from "@/lib/content/types";

type ReuseItem = {
  postId: string;
  postNumber: number;
  scheduled_date: string;
  item: ContentMediaItem;
};

export function PostMediaPanel({
  post,
  onChanged,
  readOnly = false,
}: {
  post: ContentPost;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<ContentMediaKind>(post.media_kind || "image");
  const [format, setFormat] = useState<ContentVisualFormat>(
    post.visual_format === "story"
      ? "story"
      : post.visual_format === "reel" || post.media_kind === "video"
        ? "reel"
        : "feed"
  );
  const [split, setSplit] = useState(
    Boolean(post.media_by_platform?.linkedin?.length || post.media_by_platform?.instagram?.length)
  );
  const [platformTab, setPlatformTab] = useState<ContentPlatform | "shared">(
    split ? "instagram" : "shared"
  );
  const [links, setLinks] = useState<PublishedLinks>(post.published_links || {});
  const [reuse, setReuse] = useState<ReuseItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isLive = post.status_production === "live";
  const fmt = formatSpecForPost({
    platforms: post.platforms,
    visual_format: format,
    is_video: post.is_video,
    media_kind: kind,
  });

  const media =
    platformTab === "shared"
      ? resolvePostMedia(post)
      : resolvePostMedia(post, platformTab);

  useEffect(() => {
    setKind(post.media_kind || "image");
    setFormat(
      post.visual_format === "story"
        ? "story"
        : post.visual_format === "reel" || post.media_kind === "video"
          ? "reel"
          : "feed"
    );
    setLinks(post.published_links || {});
    setSplit(
      Boolean(post.media_by_platform?.linkedin?.length || post.media_by_platform?.instagram?.length)
    );
  }, [post]);

  useEffect(() => {
    if (readOnly || isLive) return;
    void listProjectContentMedia(post.project_id, post.id).then((res) => {
      if (res.ok) setReuse(res.items);
    });
  }, [post.project_id, post.id, post.media, post.media_by_platform, readOnly, isLive]);

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okMsg?: string) {
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) setMsg(res.error || "Failed");
      else {
        setMsg(okMsg || res.message || "Saved");
        onChanged();
      }
    });
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setMsg(null);
    start(async () => {
      const supabase = createClient();
      for (const file of list) {
        const prepared = await prepareContentMediaUpload(
          post.project_id,
          post.id,
          file.name,
          file.type,
          file.size
        );
        if (!prepared.ok) {
          setMsg(prepared.error || "Upload failed");
          return;
        }
        const { error: upErr } = await supabase.storage
          .from("content-media")
          .uploadToSignedUrl(prepared.path, prepared.token, file, {
            contentType: prepared.mimeType,
            upsert: true,
          });
        if (upErr) {
          setMsg(upErr.message);
          return;
        }
        const committed = await commitContentMedia(post.project_id, post.id, {
          path: prepared.path,
          kind: prepared.kind,
          platform: platformTab,
          media_kind: kind === "video" || prepared.kind === "video" ? "video" : kind === "carousel" ? "carousel" : undefined,
        });
        if (!committed.ok) {
          setMsg(committed.error || "Could not attach media");
          return;
        }
      }
      setMsg("Uploaded");
      onChanged();
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (readOnly || isLive) return;
    const reuseRaw = e.dataTransfer.getData("application/x-content-media");
    if (reuseRaw) {
      try {
        const item = JSON.parse(reuseRaw) as ContentMediaItem;
        run(
          () => setPostMediaFromReuse(post.project_id, post.id, item, platformTab),
          "Reused visual"
        );
        return;
      } catch {
        /* fall through */
      }
    }
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  function reorder(from: number, to: number) {
    if (from === to || readOnly || isLive) return;
    const next = [...media];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    if (platformTab === "shared") {
      run(() => setPostMedia(post.project_id, post.id, { media: next, media_kind: kind }));
    } else {
      run(() =>
        setPostMedia(post.project_id, post.id, {
          media_by_platform: { ...post.media_by_platform, [platformTab]: next },
          media_kind: kind,
        })
      );
    }
  }

  const cover = coverUrlFromMedia(media) || post.visual_asset_url;

  return (
    <div className="space-y-4">
      {msg ? (
        <p className="text-[12px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
          {msg}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Format
          </span>
          <select
            value={kind}
            disabled={readOnly || isLive || pending}
            onChange={(e) => {
              const v = e.target.value as ContentMediaKind;
              setKind(v);
              run(() =>
                setPostMedia(post.project_id, post.id, {
                  media_kind: v,
                  visual_format: v === "video" ? "reel" : format,
                })
              );
              if (v === "video") setFormat("reel");
            }}
            className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
          >
            <option value="image">Single image</option>
            <option value="carousel">Carousel</option>
            <option value="video">Video</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Aspect
          </span>
          <select
            value={format}
            disabled={readOnly || isLive || pending || kind === "video"}
            onChange={(e) => {
              const v = e.target.value as ContentVisualFormat;
              setFormat(v);
              run(() =>
                setPostMedia(post.project_id, post.id, {
                  visual_format: v,
                  media_kind:
                    v === "reel"
                      ? "video"
                      : kind === "video"
                        ? "image"
                        : kind,
                })
              );
            }}
            className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
          >
            <option value="feed">Feed — {FEED_UPLOAD_HINT}</option>
            <option value="reel">Reel — {VISUAL_FORMAT_SPECS.reel.shortLabel}</option>
            <option value="story">Story — {VISUAL_FORMAT_SPECS.story.shortLabel}</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-gray-700">
        <input
          type="checkbox"
          checked={split}
          disabled={readOnly || isLive || pending}
          onChange={(e) => {
            const on = e.target.checked;
            setSplit(on);
            setPlatformTab(on ? "instagram" : "shared");
            if (!on) {
              run(() =>
                setPostMedia(post.project_id, post.id, {
                  media_by_platform: {},
                })
              );
            }
          }}
        />
        Different creative for LinkedIn / Instagram
      </label>

      {split ? (
        <div className="flex gap-1">
          {(["instagram", "linkedin"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatformTab(p)}
              className={`px-2.5 py-1 rounded-md text-[12px] capitalize ${
                platformTab === p ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={`relative w-full overflow-hidden rounded-md border ${
          dragOver ? "border-blue-400 bg-blue-50/40" : "border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100"
        }`}
        style={{ aspectRatio: fmt.aspectCss, maxHeight: 280 }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <ImagePlus className="h-5 w-5 text-gray-400" />
            <span className="text-[12px] font-medium text-gray-600">Add visual</span>
            <span className="text-[11px] text-gray-400">{fmt.shortLabel}</span>
          </div>
        )}
        {kind === "carousel" && media.length > 1 ? (
          <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            1/{media.length}
          </span>
        ) : null}
        {kind === "video" ? (
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            Video
          </span>
        ) : null}
      </div>

      {!readOnly && !isLive ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={kind === "video" ? "video/*,image/*" : "image/*"}
            multiple={kind === "carousel"}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-[13px] text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                setPostMedia(post.project_id, post.id, {
                  media_kind: kind,
                  visual_format: format,
                })
              )
            }
            className="rounded-md border border-gray-200 px-3 py-1.5 text-[13px] text-gray-700"
          >
            Save format
          </button>
        </div>
      ) : null}

      {media.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Slides ({media.length})
          </div>
          {media.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2 py-1.5"
              draggable={!readOnly && !isLive}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(idx));
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isFinite(from)) reorder(from, idx);
              }}
            >
              {!readOnly && !isLive ? (
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              ) : null}
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.poster_url || item.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-gray-800">
                  {item.kind} · {item.source}
                </div>
                <div className="truncate text-[10px] text-gray-400">{item.url}</div>
              </div>
              {!readOnly && !isLive ? (
                <button
                  type="button"
                  className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() =>
                    run(() =>
                      removeContentMedia(post.project_id, post.id, item.id, platformTab)
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-gray-100 p-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Published links (Live)
        </div>
        <label className="block">
          <span className="text-[12px] text-gray-600">Instagram</span>
          <input
            value={links.instagram || ""}
            disabled={readOnly || pending}
            onChange={(e) => setLinks({ ...links, instagram: e.target.value })}
            placeholder="https://www.instagram.com/p/…"
            className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-gray-600">LinkedIn</span>
          <input
            value={links.linkedin || ""}
            disabled={readOnly || pending}
            onChange={(e) => setLinks({ ...links, linkedin: e.target.value })}
            placeholder="https://www.linkedin.com/posts/…"
            className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-[13px]"
          />
        </label>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => updatePublishedLinks(post.project_id, post.id, links), "Links saved")
              }
              className="rounded-md bg-gray-900 px-3 py-1.5 text-[13px] text-white disabled:opacity-50"
            >
              Save links
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await refreshLiveThumbnails(post.project_id, post.id);
                  if (!r.ok) return r;
                  return {
                    ok: true,
                    message: r.refreshed
                      ? "Thumbnail refreshed"
                      : r.message || "No new thumb",
                  };
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[13px] text-gray-700"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh thumb
            </button>
          </div>
        ) : null}
      </div>

      {!readOnly && !isLive && reuse.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Reuse from calendar — drag onto the preview
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {reuse.map((r) => (
              <button
                key={`${r.postId}-${r.item.id}`}
                type="button"
                draggable
                title={`${postLabel(r.postNumber)} · ${r.scheduled_date}`}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-content-media",
                    JSON.stringify(r.item)
                  );
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() =>
                  run(
                    () =>
                      setPostMediaFromReuse(
                        post.project_id,
                        post.id,
                        r.item,
                        platformTab
                      ),
                    "Reused visual"
                  )
                }
                className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.item.poster_url || r.item.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[8px] text-white truncate">
                  {postLabel(r.postNumber)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
