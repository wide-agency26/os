"use client";

import { Link2 } from "lucide-react";
import { coverUrlFromMedia, resolvePostMedia } from "@/lib/content/media";
import { postLabel, type ContentPost } from "@/lib/content/types";

/** Compact calendar card for IG Story rows (smaller than feed cards). */
export function ContentStoryCard({
  post,
  linkedLabel,
  onClick,
  draggable,
  onDragStart,
}: {
  post: ContentPost;
  linkedLabel?: string | null;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const media = resolvePostMedia(post);
  const cover = coverUrlFromMedia(media) || post.visual_asset_url;
  const stickers = post.story_repost?.stickers?.length
    ? post.story_repost.stickers
    : post.story_repost?.sticker_type && post.story_repost.sticker_type !== "none"
      ? [post.story_repost.sticker_type]
      : [];

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="w-full text-left rounded border border-slate-200 bg-slate-50/80 px-1 py-1 hover:border-slate-400"
    >
      <div className="flex gap-1.5">
        <div
          className={`relative w-8 shrink-0 overflow-hidden rounded border ${
            cover ? "border-slate-200 bg-slate-100" : "border-dashed border-slate-300 bg-white"
          }`}
          style={{ aspectRatio: "9 / 16" }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[7px] text-slate-400">9:16</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center gap-1">
            <span className="rounded bg-slate-800 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-white">
              Story
            </span>
            <span className="text-[9px] text-slate-500">{postLabel(post.post_number)}</span>
            {post.linked_post_id ? (
              <span title={linkedLabel || "Linked to feed post"} className="ml-auto text-slate-500">
                <Link2 className="h-2.5 w-2.5" />
              </span>
            ) : (
              <span className="ml-auto text-[8px] text-slate-400">Solo</span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] leading-snug text-slate-800 line-clamp-2">
            {post.hook_angle || "Story"}
          </div>
          {stickers.length ? (
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {stickers.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="rounded border border-slate-200 bg-white px-0.5 text-[7px] text-slate-600"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
