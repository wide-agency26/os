"use client";

import { ExternalLink, Settings2 } from "lucide-react";
import { PlatformIcon } from "./PlatformMockups";
import { formatSpecForPost } from "@/lib/content/formats";
import { coverUrlFromMedia, resolvePostMedia, isValidLinkedInPostUrl } from "@/lib/content/media";
import { isValidIgPermalink } from "@/lib/reports/instagram-organic";
import { APPROVAL_LABEL, postLabel, type ContentPost } from "@/lib/content/types";

function approvalTone(status: ContentPost["status_approval"]) {
  if (status === "approved") return "bg-emerald-50 text-emerald-800";
  if (status === "needs_review") return "bg-amber-50 text-amber-800";
  if (status === "needs_revision") return "bg-rose-50 text-rose-800";
  if (status === "on_hold") return "bg-gray-100 text-gray-500";
  return "bg-gray-50 text-gray-600";
}

export function ContentPostCard({
  post,
  onClick,
  onManage,
  draggable,
  onDragStart,
  compact = false,
  density = "comfortable",
}: {
  post: ContentPost;
  onClick?: () => void;
  /** Secondary control for Live posts (open slim manage drawer). */
  onManage?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
  /** Expanded shows larger cover + 3-line hook for calendar review. */
  density?: "comfortable" | "expanded";
}) {
  const fmt = formatSpecForPost(post);
  const media = resolvePostMedia(post);
  const cover = coverUrlFromMedia(media) || post.visual_asset_url;
  const visualHint =
    post.visual_brief?.graphic_description ||
    post.visual_brief?.background ||
    null;
  const isLive = post.status_production === "live";
  const igLink = post.published_links?.instagram || post.published_permalink;
  const liLink = post.published_links?.linkedin;
  const permalinkOk = isValidIgPermalink(igLink) || isValidLinkedInPostUrl(liLink);
  const openExternal = isLive && permalinkOk;
  const openUrl = isValidIgPermalink(igLink) ? igLink : liLink;
  const expanded = density === "expanded";

  function handleClick() {
    if (openExternal && openUrl) {
      window.open(openUrl, "_blank", "noopener,noreferrer");
      return;
    }
    onClick?.();
  }

  const kindBadge =
    post.media_kind === "carousel"
      ? media.length > 1
        ? `1/${media.length}`
        : "Carousel"
      : post.media_kind === "video"
        ? "Video"
        : null;

  return (
    <div className="relative group">
      <button
        type="button"
        draggable={draggable && !isLive}
        onDragStart={isLive ? undefined : onDragStart}
        onClick={handleClick}
        className={`w-full text-left rounded border bg-white ${
          isLive
            ? "border-emerald-200 hover:border-emerald-400"
            : "border-gray-100 hover:border-gray-300"
        } ${compact && !expanded ? "px-1.5 py-1" : "px-2 py-1.5"}`}
      >
        <div
          className={`mb-1 w-full overflow-hidden rounded relative border ${
            cover ? "border-gray-100 bg-gray-100" : "border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100"
          }`}
          style={{
            aspectRatio: fmt.aspectCss,
            maxHeight: expanded ? undefined : compact ? 72 : undefined,
          }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
              <span className="text-[8px] font-semibold uppercase tracking-wide text-gray-500">
                Add visual
              </span>
              <span className="text-[8px] text-gray-400 leading-tight">{fmt.shortLabel}</span>
            </div>
          )}
          {kindBadge ? (
            <span className="absolute left-1 top-1 rounded bg-black/55 px-1 py-0.5 text-[8px] font-medium text-white">
              {kindBadge}
            </span>
          ) : null}
          {openExternal ? (
            <span className="absolute right-1 top-1 inline-flex items-center justify-center rounded bg-black/55 p-1 text-white">
              <ExternalLink className="w-3 h-3" />
            </span>
          ) : null}
          {isLive && !permalinkOk ? (
            <span className="absolute inset-x-0 bottom-0 bg-amber-500/90 px-1 py-0.5 text-[8px] font-medium text-white text-center">
              Add published link
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {post.platforms.map((pl) => (
            <PlatformIcon key={pl} platform={pl} className="w-3 h-3 text-gray-600" />
          ))}
          <span className="text-[10px] font-medium text-gray-500">
            {postLabel(post.post_number)}
          </span>
          {post.pillar ? (
            <span className="ml-auto text-[9px] font-semibold text-gray-700">{post.pillar}</span>
          ) : null}
        </div>
        <div
          className={`text-[11px] text-gray-800 leading-snug mt-0.5 ${
            expanded ? "line-clamp-3" : "line-clamp-2"
          }`}
        >
          {post.hook_angle || "No angle yet"}
        </div>
        {visualHint && (expanded || (!compact && !isLive)) ? (
          <div className={`mt-0.5 text-[9px] text-gray-500 ${expanded ? "line-clamp-2" : "line-clamp-1"}`}>
            Visual: {visualHint}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="text-[9px] px-1 rounded bg-slate-50 text-slate-700 border border-slate-100">
            {fmt.shortLabel}
          </span>
          {!isLive ? (
            <span className={`text-[9px] px-1 rounded ${approvalTone(post.status_approval)}`}>
              {APPROVAL_LABEL[post.status_approval]}
            </span>
          ) : null}
          <span
            className={`text-[9px] px-1 rounded ${
              isLive ? "bg-emerald-50 text-emerald-800" : "bg-gray-50 text-gray-500"
            }`}
          >
            {isLive ? "Posted" : "WIP"}
          </span>
        </div>
      </button>
      {isLive && onManage ? (
        <button
          type="button"
          title="Manage posted link"
          onClick={(e) => {
            e.stopPropagation();
            onManage();
          }}
          className="absolute left-1 bottom-8 z-[1] rounded border border-white/80 bg-white/90 p-0.5 text-gray-600 opacity-0 shadow-sm group-hover:opacity-100 hover:text-gray-900"
        >
          <Settings2 className="w-3 h-3" />
        </button>
      ) : null}
    </div>
  );
}
