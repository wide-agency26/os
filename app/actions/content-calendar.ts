"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import {
  extractUploadBytes,
  guessContextMime,
} from "@/lib/content/extract-doc";
import { createAdminClient } from "@/utils/supabase/admin";
import { assembleProjectContext } from "@/lib/content/assemble";
import { seedPersonaFromCi } from "@/lib/content/ci-context";
import { ensureCalendar, ensureSettings } from "@/lib/content/load";
import type {
  ApprovalStatus,
  CalendarStatus,
  ContentMediaItem,
  ContentMediaKind,
  ContentPlatform,
  ContentSettings,
  ProductionStatus,
  PublishedLinks,
  VersionSnapshot,
} from "@/lib/content/types";
import {
  CONTENT_MEDIA_IMAGE_MAX_BYTES,
  CONTENT_MEDIA_MAX_SLIDES,
  CONTENT_MEDIA_VIDEO_MAX_BYTES,
  coverUrlFromMedia,
  createMediaItem,
  guessMediaMime,
  isValidLinkedInPostUrl,
  isVideoMime,
  mediaKindToIsVideo,
  normalizeMediaKindFromCount,
  parseMediaByPlatform,
  parseMediaList,
  parsePublishedLinks,
  resolveMediaKind,
  resolvePostMedia,
  syncPublishedPermalink,
} from "@/lib/content/media";
import { applyMediaDerivedFields } from "@/lib/content/post-patch";
import { assertPublicMediaPatch } from "@/lib/content/upload-post-media";
import { mapPost } from "@/lib/content/load";

type Sb = any;

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" as string };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { supabase, user: null, error: "Only founders can manage content calendars" };
  }
  return { supabase: supabase as Sb, user, error: null as string | null };
}

function revalidateContent(projectId: string) {
  revalidatePath(`/app/projects/${projectId}/content`);
  revalidatePath("/app/client-content");
  revalidatePath("/app/tools/content");
  revalidatePath(`/app/work/propose/${projectId}/audience`);
}

export async function saveContentSettings(
  projectId: string,
  patch: Partial<ContentSettings>
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await ensureSettings(supabase, projectId);
  const next: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.pillars) next.pillars = patch.pillars;
  if (patch.languages) next.languages = patch.languages;
  if (patch.client_languages) next.client_languages = patch.client_languages;
  if (patch.platform_personas) next.platform_personas = patch.platform_personas;
  if (patch.cadence) next.cadence = patch.cadence;
  if (patch.social_assets) next.social_assets = patch.social_assets;
  const { error: upErr } = await supabase
    .from("content_settings")
    .update(next)
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

const SOCIAL_ASSET_MAX_BYTES = 8 * 1024 * 1024;

/** Signed upload for project-level social assets (LinkedIn employee cover, etc.). */
export async function prepareSocialAssetUpload(
  projectId: string,
  filename: string,
  mimeType: string | null,
  size: number
) {
  const { error } = await requireFounder();
  if (error) return { ok: false as const, error };
  if (!filename.trim()) return { ok: false as const, error: "Choose a file." };
  if (!size) return { ok: false as const, error: "That file is empty." };
  if (size > SOCIAL_ASSET_MAX_BYTES) {
    return { ok: false as const, error: "Cover image is over 8 MB." };
  }
  const mime = guessMediaMime(filename, mimeType);
  if (!mime.startsWith("image/")) {
    return { ok: false as const, error: "Cover must be an image." };
  }

  const path = `${projectId}/social-assets/${Date.now()}-${safeMediaFilename(filename)}`;
  const admin = createAdminClient();
  const { data, error: signErr } = await admin.storage
    .from("content-media")
    .createSignedUploadUrl(path);
  if (signErr || !data?.token) {
    return { ok: false as const, error: signErr?.message || "Could not start upload." };
  }
  return { ok: true as const, path, token: data.token, mimeType: mime };
}

export async function finalizeSocialAssetUpload(
  projectId: string,
  input: {
    path: string;
    /** @deprecated Prefer kind + label for multi-cover kit */
    key?: "linkedin_employee_cover_url";
    kind?: "company" | "employee";
    label?: string;
  }
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  if (!input.path.startsWith(`${projectId}/social-assets/`)) {
    return { ok: false as const, error: "Invalid upload path." };
  }
  await ensureSettings(supabase, projectId);
  const admin = createAdminClient();
  const { data: pub } = admin.storage.from("content-media").getPublicUrl(input.path);

  const { data: row } = await supabase
    .from("content_settings")
    .select("social_assets")
    .eq("project_id", projectId)
    .maybeSingle();

  const { parseSocialAssets, newCoverId } = await import("@/lib/content/social-assets");
  const assets = parseSocialAssets(row?.social_assets);
  const kind = input.kind || (input.key === "linkedin_employee_cover_url" ? "employee" : "employee");
  const option = {
    id: newCoverId(),
    label:
      input.label?.trim() ||
      (kind === "company" ? "Company cover" : "Employee cover"),
    url: pub.publicUrl,
    kind,
    preferred: false,
  };
  if (kind === "company") {
    if (!assets.company_covers.some((c) => c.preferred)) option.preferred = true;
    assets.company_covers = [...assets.company_covers, option];
  } else {
    if (!assets.employee_covers.some((c) => c.preferred)) option.preferred = true;
    assets.employee_covers = [...assets.employee_covers, option];
    assets.linkedin_employee_cover_url =
      assets.employee_covers.find((c) => c.preferred)?.url || option.url;
  }

  const { error: upErr } = await supabase
    .from("content_settings")
    .update({ social_assets: assets, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const, url: pub.publicUrl, social_assets: assets, cover: option };
}

export async function removeSocialCover(
  projectId: string,
  coverId: string,
  kind: "company" | "employee"
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await ensureSettings(supabase, projectId);
  const { parseSocialAssets } = await import("@/lib/content/social-assets");
  const { data: row } = await supabase
    .from("content_settings")
    .select("social_assets")
    .eq("project_id", projectId)
    .maybeSingle();
  const assets = parseSocialAssets(row?.social_assets);
  if (kind === "company") {
    assets.company_covers = assets.company_covers.filter((c) => c.id !== coverId);
    if (assets.company_covers.length && !assets.company_covers.some((c) => c.preferred)) {
      assets.company_covers[0].preferred = true;
    }
  } else {
    assets.employee_covers = assets.employee_covers.filter((c) => c.id !== coverId);
    if (assets.employee_covers.length && !assets.employee_covers.some((c) => c.preferred)) {
      assets.employee_covers[0].preferred = true;
    }
    assets.linkedin_employee_cover_url =
      assets.employee_covers.find((c) => c.preferred)?.url ||
      assets.employee_covers[0]?.url ||
      null;
  }
  const { error: upErr } = await supabase
    .from("content_settings")
    .update({ social_assets: assets, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const, social_assets: assets };
}

export async function setPreferredSocialCover(
  projectId: string,
  coverId: string,
  kind: "company" | "employee"
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await ensureSettings(supabase, projectId);
  const { parseSocialAssets, markPreferred } = await import("@/lib/content/social-assets");
  const { data: row } = await supabase
    .from("content_settings")
    .select("social_assets")
    .eq("project_id", projectId)
    .maybeSingle();
  const assets = parseSocialAssets(row?.social_assets);
  if (kind === "company") {
    assets.company_covers = markPreferred(assets.company_covers, coverId);
  } else {
    assets.employee_covers = markPreferred(assets.employee_covers, coverId);
    assets.linkedin_employee_cover_url =
      assets.employee_covers.find((c) => c.preferred)?.url || null;
  }
  const { error: upErr } = await supabase
    .from("content_settings")
    .update({ social_assets: assets, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const, social_assets: assets };
}

export async function saveLinkedInEmployeeCopy(
  projectId: string,
  copy: {
    about_de?: string;
    about_en?: string;
    experience_bullets_de?: string[];
    experience_bullets_en?: string[];
    company_url?: string;
  }
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await ensureSettings(supabase, projectId);
  const { parseSocialAssets, SIGN2X_LI_COMPANY } = await import(
    "@/lib/content/social-assets"
  );
  const { data: row } = await supabase
    .from("content_settings")
    .select("social_assets")
    .eq("project_id", projectId)
    .maybeSingle();
  const assets = parseSocialAssets(row?.social_assets);
  assets.linkedin_employee_copy = {
    about_de: copy.about_de ?? assets.linkedin_employee_copy.about_de,
    about_en: copy.about_en ?? assets.linkedin_employee_copy.about_en,
    experience_bullets_de:
      copy.experience_bullets_de ?? assets.linkedin_employee_copy.experience_bullets_de,
    experience_bullets_en:
      copy.experience_bullets_en ?? assets.linkedin_employee_copy.experience_bullets_en,
    company_url:
      (copy.company_url || assets.linkedin_employee_copy.company_url || SIGN2X_LI_COMPANY).trim(),
  };
  const { error: upErr } = await supabase
    .from("content_settings")
    .update({ social_assets: assets, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const, social_assets: assets };
}

/** @deprecated Prefer removeSocialCover — clears legacy single URL only */
export async function clearSocialAsset(
  projectId: string,
  key: "linkedin_employee_cover_url" = "linkedin_employee_cover_url"
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await ensureSettings(supabase, projectId);
  const { parseSocialAssets } = await import("@/lib/content/social-assets");
  const { data: row } = await supabase
    .from("content_settings")
    .select("social_assets")
    .eq("project_id", projectId)
    .maybeSingle();
  const assets = parseSocialAssets(row?.social_assets);
  if (key === "linkedin_employee_cover_url") {
    assets.linkedin_employee_cover_url = null;
    assets.employee_covers = [];
  }
  const { error: upErr } = await supabase
    .from("content_settings")
    .update({ social_assets: assets, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const, social_assets: assets };
}

export async function seedPersonasFromCi(projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const ctx = await assembleProjectContext(supabase, projectId);
  const personas = seedPersonaFromCi(ctx.ci?.text || null);
  await ensureSettings(supabase, projectId);
  const { error: upErr } = await supabase
    .from("content_settings")
    .update({ platform_personas: personas, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const, personas };
}

const CONTEXT_MAX_BYTES = 50 * 1024 * 1024;

function safeContextFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "context";
}

/** Direct-to-storage upload ticket — never send the file through a Server Action (Next 404s >1MB). */
export async function prepareContextUpload(
  projectId: string,
  filename: string,
  mimeType: string | null,
  size: number
) {
  const { error } = await requireFounder();
  if (error) return { ok: false as const, error };
  if (!filename.trim()) return { ok: false as const, error: "Choose a file." };
  if (!size) return { ok: false as const, error: "That file is empty." };
  if (size > CONTEXT_MAX_BYTES) {
    return { ok: false as const, error: "File is over 50 MB." };
  }

  const path = `${projectId}/${Date.now()}-${safeContextFilename(filename)}`;
  const admin = createAdminClient();
  const { data, error: signErr } = await admin.storage
    .from("content-context")
    .createSignedUploadUrl(path);
  if (signErr || !data?.token) {
    return { ok: false as const, error: signErr?.message || "Could not start upload." };
  }

  return {
    ok: true as const,
    path,
    token: data.token,
    mimeType: guessContextMime(filename, mimeType),
  };
}

export async function finalizeContextUpload(
  projectId: string,
  input: { path: string; filename: string; mimeType?: string | null }
) {
  const { user, error } = await requireFounder();
  if (error || !user) return { ok: false as const, error: error || "Not authenticated" };
  if (!input.path.startsWith(`${projectId}/`)) {
    return { ok: false as const, error: "Invalid upload path." };
  }

  try {
    const admin = createAdminClient();
    const { data: blob, error: dlErr } = await admin.storage
      .from("content-context")
      .download(input.path);
    if (dlErr || !blob) {
      return { ok: false as const, error: dlErr?.message || "Upload did not land in storage." };
    }

    const mime = guessContextMime(input.filename, input.mimeType);
    const { data: pub } = admin.storage.from("content-context").getPublicUrl(input.path);
    // Insert first so a PDF parse crash still leaves the file on the project.
    const { data: inserted, error: insErr } = await admin
      .from("content_context_docs")
      .insert([
        {
          project_id: projectId,
          filename: input.filename,
          file_url: pub.publicUrl,
          file_path: input.path,
          mime_type: mime,
          extracted_text: `[Uploaded: ${input.filename}. Extracting text…]`,
          active: true,
          uploaded_by: user.id,
        },
      ])
      .select("id")
      .maybeSingle();
    if (insErr) return { ok: false as const, error: insErr.message };

    const buffer = Buffer.from(await blob.arrayBuffer());
    let extractedText = `[File uploaded: ${input.filename}]`;
    try {
      const extracted = await extractUploadBytes({
        buffer,
        filename: input.filename,
        mimeType: mime,
      });
      extractedText = extracted.text;
    } catch (err: any) {
      extractedText = `[Uploaded: ${input.filename}. Text could not be extracted — ${err?.message || "parse failed"}.]`;
    }
    if (inserted?.id) {
      await admin
        .from("content_context_docs")
        .update({ extracted_text: extractedText })
        .eq("id", inserted.id);
    }
    revalidateContent(projectId);
    return { ok: true as const };
  } catch (err: any) {
    return { ok: false as const, error: err?.message || "Could not save the context file." };
  }
}

export async function setContextDocActive(id: string, projectId: string, active: boolean) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("content_context_docs")
    .update({ active })
    .eq("id", id)
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function removeContextDoc(id: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { data } = await supabase
    .from("content_context_docs")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (data?.file_path) {
    await supabase.storage.from("content-context").remove([data.file_path]);
  }
  const { error: delErr } = await supabase
    .from("content_context_docs")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);
  if (delErr) return { ok: false as const, error: delErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function setCalendarStatus(
  calendarId: string,
  projectId: string,
  status: CalendarStatus
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("content_calendars")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", calendarId);
  if (upErr) return { ok: false as const, error: upErr.message };

  // Sharing a month unlocks draft + on_hold posts for client review.
  if (status === "in_review" || status === "approved") {
    await supabase
      .from("content_posts")
      .update({ status_approval: "needs_review", updated_at: new Date().toISOString() })
      .eq("calendar_id", calendarId)
      .eq("locked", false)
      .in("status_approval", ["draft", "on_hold"]);
  }

  revalidateContent(projectId);
  return { ok: true as const };
}

export async function setCalendarTheme(
  calendarId: string,
  projectId: string,
  theme_notes: string
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("content_calendars")
    .update({ theme_notes, updated_at: new Date().toISOString() })
    .eq("id", calendarId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function moveContentPost(
  postId: string,
  projectId: string,
  scheduled_date: string
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("content_posts")
    .update({ scheduled_date, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

/**
 * Create an Instagram Story calendar row (standalone or linked to a feed/reel post).
 */
export async function createContentStory(
  projectId: string,
  input: {
    calendarId: string;
    scheduled_date: string;
    linked_post_id?: string | null;
    hook_angle?: string;
    story_repost?: Record<string, unknown> | null;
    pillar?: string | null;
  }
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };

  if (input.linked_post_id) {
    const { data: parent } = await supabase
      .from("content_posts")
      .select("id, visual_format, calendar_id, project_id")
      .eq("id", input.linked_post_id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!parent) return { ok: false as const, error: "Linked post not found" };
    if (parent.visual_format === "story") {
      return { ok: false as const, error: "Cannot link a Story to another Story" };
    }
    if (parent.calendar_id !== input.calendarId) {
      return { ok: false as const, error: "Linked post must be in the same calendar" };
    }
  }

  const settings = await ensureSettings(supabase, projectId);
  const postNumber = settings.next_post_number;
  const { error: numErr } = await supabase
    .from("content_settings")
    .update({ next_post_number: postNumber + 1, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (numErr) return { ok: false as const, error: numErr.message };

  const storyPlan = input.story_repost || {
    strategy_text: "",
    sticker_type: "link",
    stickers: ["link"],
    link_url: "",
    cta_hint: "",
    frame_notes: "",
  };

  const { data: inserted, error: insErr } = await supabase
    .from("content_posts")
    .insert([
      {
        calendar_id: input.calendarId,
        project_id: projectId,
        post_number: postNumber,
        platforms: ["instagram"],
        scheduled_date: input.scheduled_date,
        pillar: input.pillar || "PRODUCT",
        hook_angle: input.hook_angle || "IG Story",
        visual_brief: {
          background: "9:16 Story frame",
          style_notes:
            "Type contrast: dark bg → white/cream; light bg → blue #1041F4. No floating logo.",
          graphic_description: "IG Story still",
        },
        visual_format: "story",
        media_kind: "image",
        media: [],
        media_by_platform: {},
        captions: { instagram: { de: "", en: "" } },
        hashtags: {},
        team_reshare_captions: {},
        voiceover_script: {},
        ad_status: "organic",
        story_repost: storyPlan,
        linked_post_id: input.linked_post_id || null,
        is_video: false,
        status_production: "wip",
        status_approval: "draft",
        angle_approved: false,
        locked: false,
        remarks: input.linked_post_id ? "Linked IG Story" : "Standalone IG Story",
      },
    ])
    .select("id, post_number")
    .single();

  if (insErr) return { ok: false as const, error: insErr.message };
  revalidateContent(projectId);
  return {
    ok: true as const,
    id: inserted.id as string,
    post_number: Number(inserted.post_number),
  };
}

const LIVE_CONTENT_KEYS = new Set([
  "captions",
  "hashtags",
  "hook_angle",
  "pillar",
  "visual_brief",
  "visual_asset_url",
  "visual_format",
  "platforms",
  "voiceover_script",
  "story_repost",
  "linked_post_id",
  "is_video",
  "remarks",
  "team_reshare_captions",
  "ad_status",
  "media",
  "media_kind",
  "media_by_platform",
]);

async function normalizePublishedLinksPatch(
  patch: Record<string, unknown>,
  existing: Record<string, unknown>
) {
  const { isValidIgPermalink } = await import("@/lib/reports/instagram-organic");

  let links = parsePublishedLinks(
    patch.published_links !== undefined ? patch.published_links : existing.published_links,
    existing.published_permalink as string | null
  );

  if (patch.published_permalink !== undefined) {
    const url = String(patch.published_permalink || "").trim();
    if (url) {
      if (!isValidIgPermalink(url)) {
        return { error: "Instagram permalink must be a /p/ or /reel/ URL." };
      }
      links = { ...links, instagram: url };
    } else {
      const next = { ...links };
      delete next.instagram;
      links = next;
    }
  }

  if (patch.published_links !== undefined && patch.published_links !== null) {
    const incoming = parsePublishedLinks(patch.published_links, null);
    if (incoming.instagram) {
      if (!isValidIgPermalink(incoming.instagram)) {
        return { error: "Instagram permalink must be a /p/ or /reel/ URL." };
      }
    }
    if (incoming.linkedin) {
      if (!isValidLinkedInPostUrl(incoming.linkedin)) {
        return {
          error:
            "LinkedIn link should be a post / activity URL (linkedin.com/posts/… or feed/update).",
        };
      }
    }
    links = incoming;
  }

  patch.published_links = links;
  patch.published_permalink = syncPublishedPermalink(links);
  return { error: null as string | null, links };
}

export async function updateContentPost(
  postId: string,
  projectId: string,
  patch: Record<string, unknown>
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { data: existing } = await supabase
    .from("content_posts")
    .select("*")
    .eq("id", postId)
    .single();
  if (!existing) return { ok: false as const, error: "Post not found" };

  const goingLive = patch.status_production === "live";
  const revertingWip =
    patch.status_production === "wip" && existing.status_production === "live";
  const staysLive =
    existing.status_production === "live" && patch.status_production !== "wip";

  if (staysLive || goingLive) {
    const touchingContent = Object.keys(patch).some((k) => LIVE_CONTENT_KEYS.has(k));
    if (touchingContent && !revertingWip) {
      return {
        ok: false as const,
        error:
          "Live posts are not editable. Revert to WIP first, or only update published links / live thumbs.",
      };
    }
  }

  const linkNorm = await normalizePublishedLinksPatch(patch, existing);
  if (linkNorm.error) return { ok: false as const, error: linkNorm.error };

  if (goingLive) {
    const links = linkNorm.links || {};
    if (!links.instagram && !links.linkedin) {
      return {
        ok: false as const,
        error: "Marking Live requires an Instagram and/or LinkedIn published link.",
      };
    }
  }

  try {
    const mediaErr = assertPublicMediaPatch(patch);
    if (mediaErr) return { ok: false as const, error: mediaErr };
    applyMediaDerivedFields(patch, existing);
  } catch (err: any) {
    return { ok: false as const, error: err?.message || "Invalid media payload" };
  }

  if (existing.locked && patch.status_approval !== "needs_revision" && !patch.locked) {
    const unlocking = patch.locked === false;
    if (!unlocking && (patch.captions || patch.hook_angle || patch.hashtags)) {
      return { ok: false as const, error: "Approved posts are locked. Unlock to edit." };
    }
  }
  const history: VersionSnapshot[] = Array.isArray(existing.version_history)
    ? existing.version_history
    : [];
  if (patch.captions || patch.hook_angle || patch.visual_brief) {
    history.push({
      at: new Date().toISOString(),
      kind: "edit",
      hook_angle: existing.hook_angle,
      captions: existing.captions,
      hashtags: existing.hashtags,
      visual_brief: existing.visual_brief,
      voiceover_script: existing.voiceover_script,
      story_repost: existing.story_repost,
    });
  }
  const next: Record<string, unknown> = {
    version_history: history,
    updated_at: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) next[k] = v;
  }
  if (patch.status_approval === "approved") next.locked = true;
  if (goingLive) next.locked = true;
  if (revertingWip && patch.locked === undefined) next.locked = false;
  const { error: upErr } = await supabase.from("content_posts").update(next).eq("id", postId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function setPostApproval(
  postId: string,
  projectId: string,
  status: ApprovalStatus
) {
  return updateContentPost(postId, projectId, {
    status_approval: status,
    locked: status === "approved",
    angle_approved: status === "approved" ? true : undefined,
  });
}

export async function setPostProduction(
  postId: string,
  projectId: string,
  status: ProductionStatus
) {
  return updateContentPost(postId, projectId, {
    status_production: status,
    ...(status === "live" ? { locked: true } : {}),
  });
}

/** Reschedule a missed past idea onto today or a future date. */
export async function carryOverContentPost(
  postId: string,
  projectId: string,
  newDate: string
) {
  const { contentToday } = await import("@/lib/content/calendar-day");
  const today = contentToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || newDate < today) {
    return { ok: false as const, error: "Carry over date must be today or later." };
  }
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { data: existing } = await supabase
    .from("content_posts")
    .select("id, status_production")
    .eq("id", postId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Post not found" };
  if (existing.status_production === "live") {
    return { ok: false as const, error: "Live posts cannot be carried over." };
  }
  const { error: upErr } = await supabase
    .from("content_posts")
    .update({
      scheduled_date: newDate,
      locked: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

/** Mark a missed idea as posted (Live), optional Instagram permalink. */
export async function markContentPostPosted(
  postId: string,
  projectId: string,
  permalink?: string | null
) {
  return updateContentPost(postId, projectId, {
    status_production: "live",
    locked: true,
    ...(permalink !== undefined ? { published_permalink: permalink || null } : {}),
  });
}

/** Drop a missed idea from the carry-over strip (on_hold). */
export async function dropMissedContentPost(postId: string, projectId: string) {
  return updateContentPost(postId, projectId, {
    status_approval: "on_hold",
  });
}

export async function approveAllAngles(calendarId: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("content_posts")
    .update({ angle_approved: true, updated_at: new Date().toISOString() })
    .eq("calendar_id", calendarId)
    .eq("locked", false);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function shareCalendarWithClient(calendarId: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: calErr } = await supabase
    .from("content_calendars")
    .update({ status: "in_review", updated_at: new Date().toISOString() })
    .eq("id", calendarId);
  if (calErr) return { ok: false as const, error: calErr.message };
  // Draft + on_hold → needs_review so the full shared month appears on the client portal.
  await supabase
    .from("content_posts")
    .update({ status_approval: "needs_review", updated_at: new Date().toISOString() })
    .eq("calendar_id", calendarId)
    .eq("locked", false)
    .in("status_approval", ["draft", "on_hold"]);
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function approveAllPosts(calendarId: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("content_posts")
    .update({
      status_approval: "approved",
      locked: true,
      angle_approved: true,
      updated_at: new Date().toISOString(),
    })
    .eq("calendar_id", calendarId)
    .in("status_approval", ["needs_review", "draft", "on_hold"]);
  if (upErr) return { ok: false as const, error: upErr.message };

  // Approve all = calendar is approved and visible on the client portal.
  const { error: calErr } = await supabase
    .from("content_calendars")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", calendarId);
  if (calErr) return { ok: false as const, error: calErr.message };

  revalidateContent(projectId);
  return { ok: true as const };
}

export async function unlockPost(postId: string, projectId: string) {
  return updateContentPost(postId, projectId, { locked: false });
}

export async function deleteContentPost(postId: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: delErr } = await supabase.from("content_posts").delete().eq("id", postId);
  if (delErr) return { ok: false as const, error: delErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function addStaffComment(postId: string, projectId: string, body: string) {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false as const, error: error || "Not authenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const { error: insErr } = await supabase.from("content_post_comments").insert([
    {
      post_id: postId,
      author_id: user.id,
      author_name: profile?.full_name || "WIDE",
      body: body.trim(),
    },
  ]);
  if (insErr) return { ok: false as const, error: insErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function resolveComment(id: string, projectId: string, resolved: boolean) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("content_post_comments")
    .update({ resolved })
    .eq("id", id);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function markNotificationsRead(projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await supabase
    .from("content_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .is("read_at", null);
  revalidateContent(projectId);
  return { ok: true as const };
}

export async function addClientComment(postId: string, projectId: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  const db = supabase as any;
  const { error: insErr } = await db.from("content_post_comments").insert([
    {
      post_id: postId,
      author_id: user.id,
      author_name: profile?.full_name || "Client",
      body: body.trim(),
    },
  ]);
  if (insErr) return { ok: false as const, error: insErr.message };
  await db.from("content_notifications").insert([
    {
      project_id: projectId,
      post_id: postId,
      kind: "comment",
      message: `${profile?.full_name || "Client"} commented on a post`,
    },
  ]);
  revalidatePath("/app/client-content");
  revalidatePath(`/app/projects/${projectId}/content`);
  return { ok: true as const };
}

function safeMediaFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "media";
}

/** Direct-to-storage upload ticket for post creatives. */
export async function prepareContentMediaUpload(
  projectId: string,
  postId: string,
  filename: string,
  mimeType: string | null,
  size: number
) {
  const { error } = await requireFounder();
  if (error) return { ok: false as const, error };
  if (!filename.trim()) return { ok: false as const, error: "Choose a file." };
  if (!size) return { ok: false as const, error: "That file is empty." };

  const mime = guessMediaMime(filename, mimeType);
  const max = isVideoMime(mime) ? CONTENT_MEDIA_VIDEO_MAX_BYTES : CONTENT_MEDIA_IMAGE_MAX_BYTES;
  if (size > max) {
    return {
      ok: false as const,
      error: isVideoMime(mime) ? "Video preview is over 50 MB." : "Image is over 10 MB.",
    };
  }

  const path = `${projectId}/${postId}/${Date.now()}-${safeMediaFilename(filename)}`;
  const admin = createAdminClient();
  const { data, error: signErr } = await admin.storage
    .from("content-media")
    .createSignedUploadUrl(path);
  if (signErr || !data?.token) {
    return { ok: false as const, error: signErr?.message || "Could not start upload." };
  }

  return {
    ok: true as const,
    path,
    token: data.token,
    mimeType: mime,
    kind: (isVideoMime(mime) ? "video" : "image") as "image" | "video",
  };
}

export async function commitContentMedia(
  projectId: string,
  postId: string,
  input: {
    path: string;
    kind?: "image" | "video";
    poster_url?: string | null;
    platform?: ContentPlatform | "shared";
    media_kind?: ContentMediaKind;
  }
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  if (!input.path.startsWith(`${projectId}/${postId}/`)) {
    return { ok: false as const, error: "Invalid upload path." };
  }

  const { data: existing } = await supabase
    .from("content_posts")
    .select("*")
    .eq("id", postId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Post not found" };
  if (existing.status_production === "live") {
    return { ok: false as const, error: "Live posts cannot receive new uploads. Revert to WIP first." };
  }

  const admin = createAdminClient();
  const { data: pub } = admin.storage.from("content-media").getPublicUrl(input.path);
  const item = createMediaItem({
    url: pub.publicUrl,
    kind: input.kind || "image",
    source: "upload",
    storage_path: input.path,
    poster_url: input.poster_url,
  });

  const post = mapPost(existing);
  const platform = input.platform || "shared";
  let media = [...post.media];
  let media_by_platform = { ...post.media_by_platform };

  if (platform === "shared") {
    if (media.length >= CONTENT_MEDIA_MAX_SLIDES) {
      return { ok: false as const, error: `Carousel is capped at ${CONTENT_MEDIA_MAX_SLIDES} slides.` };
    }
    media = [...media, item];
  } else {
    const list = [...(media_by_platform[platform] || [])];
    if (list.length >= CONTENT_MEDIA_MAX_SLIDES) {
      return { ok: false as const, error: `Carousel is capped at ${CONTENT_MEDIA_MAX_SLIDES} slides.` };
    }
    media_by_platform = { ...media_by_platform, [platform]: [...list, item] };
  }

  const kind =
    input.media_kind ||
    (item.kind === "video"
      ? "video"
      : normalizeMediaKindFromCount(
          post.media_kind,
          platform === "shared" ? media.length : (media_by_platform[platform]?.length || 0)
        ));

  return updateContentPost(postId, projectId, {
    media,
    media_by_platform,
    media_kind: kind,
  });
}

export async function setPostMedia(
  projectId: string,
  postId: string,
  input: {
    media?: ContentMediaItem[];
    media_by_platform?: Partial<Record<ContentPlatform, ContentMediaItem[]>>;
    media_kind?: ContentMediaKind;
    visual_format?: "feed" | "reel" | "story";
  }
) {
  return updateContentPost(postId, projectId, {
    ...(input.media !== undefined ? { media: input.media } : {}),
    ...(input.media_by_platform !== undefined
      ? { media_by_platform: input.media_by_platform }
      : {}),
    ...(input.media_kind !== undefined ? { media_kind: input.media_kind } : {}),
    ...(input.visual_format !== undefined ? { visual_format: input.visual_format } : {}),
  });
}

export async function removeContentMedia(
  projectId: string,
  postId: string,
  mediaId: string,
  platform: ContentPlatform | "shared" = "shared"
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { data: existing } = await supabase
    .from("content_posts")
    .select("*")
    .eq("id", postId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Post not found" };
  if (existing.status_production === "live") {
    return { ok: false as const, error: "Live posts are locked. Revert to WIP to change media." };
  }

  const post = mapPost(existing);
  let removed: ContentMediaItem | undefined;
  let media = post.media;
  let media_by_platform = { ...post.media_by_platform };

  if (platform === "shared") {
    removed = media.find((m) => m.id === mediaId);
    media = media.filter((m) => m.id !== mediaId);
  } else {
    const list = media_by_platform[platform] || [];
    removed = list.find((m) => m.id === mediaId);
    media_by_platform = {
      ...media_by_platform,
      [platform]: list.filter((m) => m.id !== mediaId),
    };
    if (!(media_by_platform[platform]?.length)) {
      const next = { ...media_by_platform };
      delete next[platform];
      media_by_platform = next;
    }
  }

  if (removed?.storage_path) {
    const admin = createAdminClient();
    await admin.storage.from("content-media").remove([removed.storage_path]);
  }

  return updateContentPost(postId, projectId, {
    media,
    media_by_platform,
    media_kind: normalizeMediaKindFromCount(
      post.media_kind === "video" ? "video" : "image",
      media.length
    ),
  });
}

export async function setPostMediaFromReuse(
  projectId: string,
  postId: string,
  item: ContentMediaItem,
  platform: ContentPlatform | "shared" = "shared"
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { data: existing } = await supabase
    .from("content_posts")
    .select("*")
    .eq("id", postId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Post not found" };
  if (existing.status_production === "live") {
    return { ok: false as const, error: "Live posts cannot receive reused media." };
  }

  const post = mapPost(existing);
  const reused = createMediaItem({
    url: item.url,
    kind: item.kind,
    source: "reuse",
    poster_url: item.poster_url,
  });

  let media = [...post.media];
  let media_by_platform = { ...post.media_by_platform };
  if (platform === "shared") {
    if (media.length >= CONTENT_MEDIA_MAX_SLIDES) {
      return { ok: false as const, error: `Carousel is capped at ${CONTENT_MEDIA_MAX_SLIDES} slides.` };
    }
    media = [...media, reused];
  } else {
    const list = [...(media_by_platform[platform] || [])];
    if (list.length >= CONTENT_MEDIA_MAX_SLIDES) {
      return { ok: false as const, error: `Carousel is capped at ${CONTENT_MEDIA_MAX_SLIDES} slides.` };
    }
    media_by_platform = { ...media_by_platform, [platform]: [...list, reused] };
  }

  return updateContentPost(postId, projectId, {
    media,
    media_by_platform,
    media_kind: reused.kind === "video" ? "video" : normalizeMediaKindFromCount("image", media.length),
  });
}

/** List media from other posts in the project for the reuse tray. */
export async function listProjectContentMedia(projectId: string, excludePostId?: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error, items: [] as Array<{
    postId: string;
    postNumber: number;
    scheduled_date: string;
    item: ContentMediaItem;
  }> };

  const { data } = await supabase
    .from("content_posts")
    .select("id, post_number, scheduled_date, media, media_by_platform, visual_asset_url")
    .eq("project_id", projectId)
    .order("scheduled_date", { ascending: false })
    .limit(80);

  const items: Array<{
    postId: string;
    postNumber: number;
    scheduled_date: string;
    item: ContentMediaItem;
  }> = [];
  const seen = new Set<string>();

  for (const row of data || []) {
    if (excludePostId && row.id === excludePostId) continue;
    const post = mapPost(row);
    const slides = [
      ...resolvePostMedia(post),
      ...Object.values(post.media_by_platform || {}).flat(),
    ];
    for (const slide of slides) {
      const key = slide.url;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        postId: post.id,
        postNumber: post.post_number,
        scheduled_date: post.scheduled_date,
        item: slide,
      });
      if (items.length >= 48) break;
    }
    if (items.length >= 48) break;
  }

  return { ok: true as const, items };
}

/**
 * Refresh cover from published links. IG: Meta dataset match or oEmbed thumbnail.
 * LinkedIn: keep existing upload/paste (no scrape).
 */
export async function refreshLiveThumbnails(projectId: string, postId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("content_posts")
    .select("*")
    .eq("id", postId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!existing) return { ok: false as const, error: "Post not found" };

  const post = mapPost(existing);
  const links = post.published_links || {};
  let media = [...post.media];
  let updated = false;

  if (links.instagram) {
    const { isValidIgPermalink } = await import("@/lib/reports/instagram-organic");
    if (!isValidIgPermalink(links.instagram)) {
      return { ok: false as const, error: "Instagram permalink must be a /p/ or /reel/ URL." };
    }

    let thumb: string | null = null;
    try {
      const { data: datasets } = await admin
        .from("report_datasets")
        .select("id, rows, is_current")
        .eq("project_id", projectId)
        .eq("subcategory", "instagram_posts")
        .order("created_at", { ascending: false })
        .limit(5);
      for (const ds of datasets || []) {
        const rows = Array.isArray(ds.rows) ? ds.rows : [];
        for (const raw of rows) {
          const row = raw as Record<string, unknown>;
          const url = String(row.post_url || row["Post URL"] || row.permalink || "").trim();
          if (url && url === links.instagram) {
            thumb = String(row.thumbnail_url || row["Thumbnail URL"] || row.media_url || "").trim() || null;
            break;
          }
        }
        if (thumb) break;
      }
    } catch {
      /* best-effort */
    }

    if (!thumb) {
      try {
        const oembed = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(links.instagram)}`;
        // Public oEmbed often blocked; try meta open-graph via micro-fetch of HTML is unreliable.
        // Fall back: Instagram media CDN not available without token — leave media if present.
        const res = await fetch(
          `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(links.instagram)}&omitscript=true`,
          { next: { revalidate: 0 } }
        ).catch(() => null);
        if (res?.ok) {
          const json = (await res.json()) as { thumbnail_url?: string };
          thumb = json.thumbnail_url || null;
        }
      } catch {
        /* ignore */
      }
    }

    if (thumb) {
      const withoutLive = media.filter((m) => m.source !== "live_ig");
      media = [
        createMediaItem({ url: thumb, kind: post.media_kind === "video" ? "video" : "image", source: "live_ig" }),
        ...withoutLive,
      ];
      updated = true;
    }
  }

  if (!updated && !coverUrlFromMedia(media) && post.visual_asset_url) {
    return { ok: true as const, refreshed: false, message: "No new thumbnail found; keep existing cover." };
  }
  if (!updated) {
    return {
      ok: true as const,
      refreshed: false,
      message: links.linkedin
        ? "LinkedIn thumbs need a manual upload. Instagram thumb not found in synced data."
        : "Could not resolve an Instagram thumbnail. Paste an image URL or upload after reverting to WIP.",
    };
  }

  const cover = coverUrlFromMedia(media);
  const { error: upErr } = await admin
    .from("content_posts")
    .update({
      media,
      visual_asset_url: cover,
      published_links: links,
      published_permalink: syncPublishedPermalink(links),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateContent(projectId);
  return { ok: true as const, refreshed: true };
}

export async function updatePublishedLinks(
  projectId: string,
  postId: string,
  links: PublishedLinks
) {
  const res = await updateContentPost(postId, projectId, {
    published_links: links,
  });
  if (!res.ok) return res;
  const refresh = await refreshLiveThumbnails(projectId, postId);
  return { ...res, refresh };
}
