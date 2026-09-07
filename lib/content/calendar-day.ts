import { isValidIgPermalink } from "@/lib/reports/instagram-organic";
import { isValidLinkedInPostUrl } from "@/lib/content/media";
import type { ContentPost } from "./types";

const TZ = "Europe/Berlin";

/** Calendar "today" in Europe/Berlin as YYYY-MM-DD. */
export function contentToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isPastScheduledDate(scheduledDate: string, today = contentToday()): boolean {
  return Boolean(scheduledDate) && scheduledDate < today;
}

export function hasConfirmedSocialPost(post: ContentPost): boolean {
  if (post.status_production === "live") return true;
  if (isValidIgPermalink(post.published_permalink)) return true;
  if (isValidIgPermalink(post.published_links?.instagram)) return true;
  if (isValidLinkedInPostUrl(post.published_links?.linkedin)) return true;
  return false;
}

/** Past WIP with no confirmed Live / IG permalink — show in carry-over, not on the day grid. */
export function isMissedPost(post: ContentPost, today = contentToday()): boolean {
  if (!isPastScheduledDate(post.scheduled_date, today)) return false;
  if (post.status_approval === "on_hold") return false;
  if (hasConfirmedSocialPost(post)) return false;
  return true;
}

/** Posts that belong on a past day cell (posted cards only). */
export function showOnPastDayGrid(post: ContentPost): boolean {
  return hasConfirmedSocialPost(post);
}

export function defaultCarryOverDate(today = contentToday()): string {
  return today;
}
