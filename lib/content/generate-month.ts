import { assembleProjectContext } from "@/lib/content/assemble";
import {
  generateAnglePlan,
  generateFullCopy,
  generateSingleAngle,
} from "@/lib/content/generate";
import { allocatePostNumbers, ensureCalendar, mapPost } from "@/lib/content/load";
import { monthStart } from "@/lib/content/types";
import type { VersionSnapshot } from "@/lib/content/types";

type Sb = any;

export type GenerateMonthStep = "angles" | "full" | "post_angle" | "post_full";

export type GenerateMonthInput = {
  step: GenerateMonthStep;
  projectId: string;
  periodStart?: string;
  themeNotes?: string;
  postId?: string;
  replace?: boolean;
  regenerateDrafts?: boolean;
};

function snapshot(row: any, kind: VersionSnapshot["kind"]): VersionSnapshot {
  return {
    at: new Date().toISOString(),
    kind,
    hook_angle: row.hook_angle,
    captions: row.captions,
    hashtags: row.hashtags,
    visual_brief: row.visual_brief,
    voiceover_script: row.voiceover_script,
    story_repost: row.story_repost,
  };
}

function hasCaptions(captions: unknown) {
  if (!captions || typeof captions !== "object") return false;
  return Object.values(captions as Record<string, unknown>).some((langs) => {
    if (!langs || typeof langs !== "object") return false;
    return Object.values(langs as Record<string, unknown>).some(
      (v) => typeof v === "string" && v.trim()
    );
  });
}

export type GenerateMonthResult =
  | {
      ok: false;
      error: string;
      calendarId?: string;
      generated?: number;
      failed?: { id: string; post_number: number; ok: boolean; error?: string }[];
    }
  | {
      ok: true;
      calendarId: string;
      created?: number;
      generated?: number;
      failed?: { id: string; post_number: number; ok: boolean; error?: string }[];
      postId?: string;
      hook_angle?: string;
    };

export async function runContentMonthGeneration(
  supabase: Sb,
  input: GenerateMonthInput
): Promise<GenerateMonthResult> {
  const periodStart = input.periodStart || monthStart(new Date());
  const context = await assembleProjectContext(supabase, input.projectId);
  const calendar = await ensureCalendar(supabase, input.projectId, periodStart);

  if (input.step === "angles") {
    const { data: existing } = await supabase
      .from("content_posts")
      .select("id, locked")
      .eq("calendar_id", calendar.id);
    const rows = existing || [];
    if (rows.length && !input.replace) {
      return {
        ok: false,
        error: "This month already has posts. Unlock and replace, or regenerate one at a time.",
      };
    }
    if (input.replace) {
      const unlocked = rows
        .filter((r: { locked: boolean }) => !r.locked)
        .map((r: { id: string }) => r.id);
      if (unlocked.length) {
        await supabase.from("content_posts").delete().in("id", unlocked);
      }
    }

    if (input.themeNotes != null) {
      await supabase
        .from("content_calendars")
        .update({ theme_notes: input.themeNotes, updated_at: new Date().toISOString() })
        .eq("id", calendar.id);
    }

    const planned = await generateAnglePlan({
      context,
      periodStart,
      themeNotes: input.themeNotes || calendar.theme_notes || undefined,
    });
    if (!planned.ok) return { ok: false, error: planned.error };

    const numbers = await allocatePostNumbers(supabase, input.projectId, planned.plan.length);
    const inserts = planned.plan.map((p, i) => ({
      calendar_id: calendar.id,
      project_id: input.projectId,
      post_number: numbers[i],
      platforms: p.platforms,
      scheduled_date: p.scheduled_date,
      pillar: p.pillar,
      hook_angle: p.hook_angle,
      is_video: p.is_video,
      media_kind: p.is_video ? "video" : "image",
      media: [],
      media_by_platform: {},
      published_links: {},
      visual_format: p.is_video ? "reel" : "feed",
      status_approval: "draft",
      status_production: "wip",
      angle_approved: false,
    }));
    const { error } = await supabase.from("content_posts").insert(inserts);
    if (error) return { ok: false, error: error.message };
    return { ok: true, calendarId: calendar.id, created: inserts.length };
  }

  if (input.step === "full") {
    const { data: rows } = await supabase
      .from("content_posts")
      .select("*")
      .eq("calendar_id", calendar.id)
      .eq("angle_approved", true)
      .eq("locked", false)
      .order("scheduled_date")
      .order("post_number");

    const targets = (rows || []).filter((row: any) => {
      if (input.regenerateDrafts) {
        return ["draft", "needs_review", "needs_revision"].includes(row.status_approval);
      }
      return !hasCaptions(row.captions);
    });

    if (!targets.length) {
      return {
        ok: false,
        error: "No unlocked, angle-approved posts waiting for copy.",
      };
    }

    const results: { id: string; post_number: number; ok: boolean; error?: string }[] = [];
    for (const row of targets) {
      const post = mapPost(row);
      const copy = await generateFullCopy({
        context,
        post: {
          pillar: post.pillar,
          hook_angle: post.hook_angle,
          platforms: post.platforms,
          is_video: post.is_video,
          scheduled_date: post.scheduled_date,
        },
      });
      if (!copy.ok) {
        results.push({ id: row.id, post_number: row.post_number, ok: false, error: copy.error });
        continue;
      }
      const history = Array.isArray(row.version_history) ? row.version_history : [];
      history.push(snapshot(row, "full"));
      const { error } = await supabase
        .from("content_posts")
        .update({
          captions: copy.copy.captions,
          hashtags: {},
          visual_brief: copy.copy.visual_brief,
          voiceover_script: copy.copy.voiceover_script,
          story_repost: copy.copy.story_repost,
          ad_status: copy.copy.ad_status,
          visual_format: copy.copy.visual_format,
          is_video: copy.copy.visual_format === "reel",
          status_approval: "needs_review",
          version_history: history,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      results.push({
        id: row.id,
        post_number: row.post_number,
        ok: !error,
        error: error?.message,
      });
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      return {
        ok: false,
        error: `Copy failed for ${failed.length} of ${results.length} posts.`,
        calendarId: calendar.id,
        generated: results.filter((r) => r.ok).length,
        failed,
      };
    }
    return {
      ok: true,
      calendarId: calendar.id,
      generated: results.length,
    };
  }

  if (input.step === "post_angle" || input.step === "post_full") {
    if (!input.postId) return { ok: false, error: "postId required" };
    const { data: row } = await supabase
      .from("content_posts")
      .select("*")
      .eq("id", input.postId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Post not found" };
    if (row.locked) {
      return { ok: false, error: "Post is locked. Unlock before regenerating." };
    }
    const post = mapPost(row);
    const history = Array.isArray(row.version_history) ? row.version_history : [];

    if (input.step === "post_angle") {
      const angle = await generateSingleAngle({
        context,
        post,
        note: input.themeNotes,
      });
      if (!angle.ok) return { ok: false, error: angle.error };
      history.push(snapshot(row, "angle"));
      const { error } = await supabase
        .from("content_posts")
        .update({
          pillar: angle.angle.pillar,
          hook_angle: angle.angle.hook_angle,
          platforms: angle.angle.platforms,
          is_video: angle.angle.is_video,
          angle_approved: false,
          version_history: history,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        calendarId: calendar.id,
        postId: row.id,
        hook_angle: angle.angle.hook_angle,
      };
    }

    const copy = await generateFullCopy({ context, post });
    if (!copy.ok) return { ok: false, error: copy.error };
    history.push(snapshot(row, "full"));
    const { error } = await supabase
      .from("content_posts")
      .update({
        captions: copy.copy.captions,
        hashtags: {},
        visual_brief: copy.copy.visual_brief,
        voiceover_script: copy.copy.voiceover_script,
        story_repost: copy.copy.story_repost,
        ad_status: copy.copy.ad_status,
        visual_format: copy.copy.visual_format,
        is_video: copy.copy.visual_format === "reel",
        status_approval: "needs_review",
        version_history: history,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, calendarId: calendar.id, postId: row.id };
  }

  return { ok: false, error: "Unknown step" };
}
