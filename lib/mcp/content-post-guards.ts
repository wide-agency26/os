import { isValidLinkedInPostUrl } from "@/lib/content/media";
import { isValidIgPermalink } from "@/lib/reports/instagram-organic";

/** MCP-only: reject Live without a valid Instagram and/or LinkedIn permalink. */
export function assertMcpLivePermalink(
  statusProduction: string | null | undefined,
  publishedPermalink: string | null | undefined,
  existingPermalink?: string | null,
  linkedInUrl?: string | null
): { ok: true; permalink: string | null; linkedin: string | null } | { ok: false; error: string } {
  if (statusProduction !== "live") {
    return {
      ok: true,
      permalink: publishedPermalink ?? existingPermalink ?? null,
      linkedin: linkedInUrl?.trim() || null,
    };
  }

  const ig =
    publishedPermalink !== undefined
      ? String(publishedPermalink || "").trim()
      : String(existingPermalink || "").trim();
  const li = String(linkedInUrl || "").trim();

  if (!ig && !li) {
    return {
      ok: false,
      error:
        "status_production=live requires published_permalink (Instagram /p or /reel) and/or a LinkedIn post URL. Do not mark unpublished social Live via MCP.",
    };
  }

  if (ig && !isValidIgPermalink(ig)) {
    return {
      ok: false,
      error:
        "published_permalink must be a valid Instagram post URL (/p/… or /reel/…). Profile URLs are not accepted for Live.",
    };
  }

  if (li && !isValidLinkedInPostUrl(li)) {
    return {
      ok: false,
      error:
        "LinkedIn URL must look like linkedin.com/posts/… or feed/update/…",
    };
  }

  return { ok: true, permalink: ig || null, linkedin: li || null };
}
