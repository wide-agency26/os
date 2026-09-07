/** Shared MCP tool descriptions for content calendar writes. */
export const CONTENT_POST_LIVE_NOTE =
  "Do not mark unpublished social Live. status_production=live requires Instagram /p|/reel and/or a LinkedIn post URL (published_permalink / published_links).";

export const VISUAL_BRIEF_MCP_DOC =
  "visual_brief JSON: feed stills use background, graphic_description, style_notes; reels/is_video use first_frame, last_frame, video_prompt (optional animation_mechanics).";

export const CONTENT_MEDIA_MCP_DOC =
  "WIP previews (status_production=wip): NEVER use file:// or local paths — browsers cannot load them. Upload images with upload_content_post_media (post_id, filename, content_base64) or ingest_content_media_from_url (post_id, url) → public https URL on content-media storage, auto-attached to the post. Or set visual_asset_url / image_urls / media[] with public https:// links only. media_kind: image|carousel|video. Live posts: media locked unless reverted to wip.";

export const CONTENT_CALENDAR_MCP_PLAYBOOK =
  "End-to-end: (1) list_projects → pick project_id. (2) generate_content_month step=angles (replace=true to rewrite month). (3) approve_all_content_angles. (4) generate_content_month step=full. (5) Per post: update_content_post captions/brief; set media_kind=carousel for multi-slide. (6) Images: ingest_content_media_from_url or upload_content_post_media — never file://. (7) update_content_calendar status=in_review to share with client. (8) approve_all_content_posts after client OK.";
