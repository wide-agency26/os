import {
  coverUrlFromMedia,
  createMediaItem,
  isPublicMediaUrl,
  mediaKindToIsVideo,
  normalizeMediaKindFromCount,
  parseMediaByPlatform,
  parseMediaList,
  publicMediaUrlError,
  resolveMediaKind,
  resolvePostMedia,
  validatePublicMediaUrls,
} from "./media";

/** Apply media / cover fields on a content_posts patch (staff + MCP). */
export function applyMediaDerivedFields(
  patch: Record<string, unknown>,
  existing: Record<string, unknown>
) {
  const media =
    patch.media !== undefined
      ? parseMediaList(patch.media)
      : parseMediaList(existing.media);
  const media_by_platform =
    patch.media_by_platform !== undefined
      ? parseMediaByPlatform(patch.media_by_platform)
      : parseMediaByPlatform(existing.media_by_platform);
  let media_kind = resolveMediaKind(
    patch.media_kind !== undefined ? patch.media_kind : existing.media_kind,
    {
      is_video: Boolean(existing.is_video),
      visual_format: String(existing.visual_format || ""),
      media,
    }
  );

  if (patch.media !== undefined) {
    patch.media = media;
    media_kind = normalizeMediaKindFromCount(media_kind, media.length);
  }
  if (patch.media_by_platform !== undefined) {
    patch.media_by_platform = media_by_platform;
  }

  if (patch.visual_asset_url !== undefined && patch.media === undefined) {
    const url = String(patch.visual_asset_url || "").trim();
    if (url) {
      if (!isPublicMediaUrl(url)) {
        throw new Error(publicMediaUrlError(url));
      }
      const slideKind = media_kind === "video" ? "video" : "image";
      patch.media = [createMediaItem({ url, kind: slideKind, source: "url" })];
      media_kind = slideKind === "video" ? "video" : "image";
    } else {
      patch.media = [];
      patch.visual_asset_url = null;
      media_kind = "image";
    }
  }

  if (
    patch.media !== undefined ||
    patch.media_kind !== undefined ||
    patch.media_by_platform !== undefined ||
    patch.visual_asset_url !== undefined
  ) {
    const finalMedia = parseMediaList(patch.media !== undefined ? patch.media : media);
    media_kind = normalizeMediaKindFromCount(
      resolveMediaKind(patch.media_kind !== undefined ? patch.media_kind : media_kind, {
        is_video: media_kind === "video",
        visual_format: String(patch.visual_format || existing.visual_format || ""),
        media: finalMedia,
      }),
      finalMedia.length
    );
    patch.media_kind = media_kind;
    patch.is_video = mediaKindToIsVideo(media_kind);
    if (media_kind === "video" && patch.visual_format === undefined) {
      patch.visual_format = "reel";
    }
    const platforms = (patch.platforms as string[]) || (existing.platforms as string[]) || [
      "instagram",
    ];
    const cover =
      coverUrlFromMedia(
        resolvePostMedia(
          {
            media: finalMedia,
            media_by_platform,
            visual_asset_url: null,
          },
          platforms[0]
        )
      ) || coverUrlFromMedia(finalMedia);
    patch.visual_asset_url = cover;
    if (patch.media === undefined) patch.media = finalMedia;
  }
}

/** Bot-friendly sugar: image_urls → media[], then derive cover. */
export function applyMcpContentMediaInput(
  patch: Record<string, unknown>,
  existing: Record<string, unknown>
) {
  if (Array.isArray(patch.image_urls)) {
    const urls = (patch.image_urls as unknown[])
      .map((u) => String(u || "").trim())
      .filter(Boolean);
    const invalid = validatePublicMediaUrls(urls);
    if (invalid) throw new Error(invalid);
    patch.media = urls.map((url) => createMediaItem({ url, kind: "image", source: "url" }));
    if (urls.length > 1) patch.media_kind = "carousel";
    else if (patch.media_kind === undefined) patch.media_kind = "image";
    delete patch.image_urls;
  }
  applyMediaDerivedFields(patch, existing);
}