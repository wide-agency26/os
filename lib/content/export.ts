import { captionAt, postLabel, type ContentPost, type ContentSettings } from "./types";

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function calendarToCsv(
  posts: ContentPost[],
  settings: ContentSettings
): string {
  const langs = settings.languages.length ? settings.languages : ["en"];
  const platforms = ["linkedin", "instagram"];
  const header = [
    "Post ID",
    "Date",
    "Platforms",
    "Pillar",
    "Hook / Angle",
    "Ad status",
    "Media kind",
    "Video",
    "Approval",
    "Production",
    "BG",
    "Graphic",
    "Style",
    "Animation",
    "Typography",
    "Asset URL",
    "IG link",
    "LI link",
    "Story strategy",
    "Story sticker",
    "Story link",
    "Story stickers",
    "Linked post",
    "Format",
    ...platforms.flatMap((p) =>
      langs.flatMap((lang) => [
        `${p} caption ${lang}`,
        `${p} hashtags ${lang}`,
      ])
    ),
    ...langs.map((lang) => `VO ${lang}`),
    ...langs.map((lang) => `Team reshare ${lang}`),
    "Remarks",
  ];

  const rows = posts.map((post) => {
    const vb = post.visual_brief || {};
    const cells = [
      postLabel(post.post_number),
      post.scheduled_date,
      (post.platforms || []).join(" + "),
      post.pillar || "",
      post.hook_angle || "",
      post.ad_status,
      post.media_kind || (post.is_video ? "video" : "image"),
      post.is_video || post.media_kind === "video" ? "video" : "static",
      post.status_approval,
      post.status_production,
      vb.background || "",
      vb.graphic_description || "",
      vb.style_notes || "",
      vb.animation_mechanics || "",
      vb.typography_notes || "",
      post.visual_asset_url || "",
      post.published_links?.instagram || post.published_permalink || "",
      post.published_links?.linkedin || "",
      post.story_repost?.strategy_text || "",
      post.story_repost?.sticker_type || "",
      post.story_repost?.link_url || "",
      (post.story_repost?.stickers || []).join("|"),
      post.linked_post_id || "",
      post.visual_format || "feed",
    ];
    for (const p of platforms) {
      for (const lang of langs) {
        cells.push(captionAt(post.captions, p, lang));
        cells.push(captionAt(post.hashtags, p, lang));
      }
    }
    for (const lang of langs) {
      cells.push(post.voiceover_script?.[lang] || "");
    }
    for (const lang of langs) {
      cells.push(post.team_reshare_captions?.[lang] || "");
    }
    cells.push(post.remarks || "");
    return cells.map(csvCell).join(",");
  });

  return [header.map(csvCell).join(","), ...rows].join("\n");
}
