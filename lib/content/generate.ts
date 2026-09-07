import { generateJsonFromGateway, hasGatewayCredentials } from "@/lib/ai/gateway-json";
import type { AssembledContext, ContentPost, VisualBrief } from "./types";

function weekdaysInMonth(periodStart: string): string[] {
  const [y, m] = periodStart.slice(0, 7).split("-").map(Number);
  const days: string[] = [];
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    days.push(
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  return days;
}

function plannedCount(cadence: Record<string, number>, weeks = 4) {
  const li = Number(cadence.linkedin || 0);
  const ig = Number(cadence.instagram || 0);
  const perWeek = Math.max(li, ig, 1);
  return Math.max(4, Math.min(24, Math.round(perWeek * weeks)));
}

export type AnglePlan = {
  scheduled_date: string;
  platforms: string[];
  pillar: string;
  hook_angle: string;
  is_video: boolean;
};

export async function generateAnglePlan(input: {
  context: AssembledContext;
  periodStart: string;
  themeNotes?: string;
}): Promise<{ ok: true; plan: AnglePlan[] } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const { settings } = input.context;
  const count = plannedCount(settings.cadence);
  const days = weekdaysInMonth(input.periodStart);

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
    system: `You are WIDE's social content strategist. Plan a month of social posts for a client. Output ONLY JSON.
Shape: { "posts": [ { "scheduled_date": "YYYY-MM-DD", "platforms": ["linkedin","instagram"], "pillar": string, "hook_angle": string, "is_video": boolean } ] }
Rules:
- Use only these pillars: ${settings.pillars.join(", ")}
- Spread posts across weekdays in the month. About ${count} posts.
- Each hook_angle is ONE strategic sentence (the idea, not the caption).
- Mix pillars. Flag is_video true only when motion is essential (product demo, before/after).
- Default platforms are both linkedin and instagram (one content piece, two voices) unless a post clearly belongs to one.
- Dates must fall in ${input.periodStart.slice(0, 7)}.
- No hashtags, no captions yet.`,
    prompt: `Month: ${input.periodStart.slice(0, 7)}
Theme/campaign notes: ${input.themeNotes || "none"}
Available weekdays: ${days.join(", ")}

CONTEXT:\n${input.context.text}`,
    maxOutputTokens: 4000,
  });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Angle generation failed." };
  }

  const posts = Array.isArray((json as any)?.posts) ? (json as any).posts : [];
  if (!posts.length) return { ok: false, error: "Model returned no angles." };

  const plan: AnglePlan[] = posts
    .map((p: any) => ({
      scheduled_date: String(p.scheduled_date || days[0]),
      platforms: Array.isArray(p.platforms) && p.platforms.length
        ? p.platforms.map(String)
        : ["linkedin", "instagram"],
      pillar: String(p.pillar || settings.pillars[0]),
      hook_angle: String(p.hook_angle || "").trim(),
      is_video: Boolean(p.is_video),
    }))
    .filter((p: AnglePlan) => p.hook_angle && p.scheduled_date.startsWith(input.periodStart.slice(0, 7)));

  if (!plan.length) return { ok: false, error: "Could not parse angle plan." };
  return { ok: true, plan };
}

export type FullCopy = {
  captions: Record<string, Record<string, string>>;
  hashtags: Record<string, Record<string, string>>;
  visual_brief: VisualBrief;
  voiceover_script: Record<string, string>;
  story_repost: { strategy_text: string; sticker_type: string } | null;
  ad_status: "organic" | "paid";
  visual_format: "feed" | "reel";
};

export async function generateFullCopy(input: {
  context: AssembledContext;
  post: Pick<ContentPost, "pillar" | "hook_angle" | "platforms" | "is_video" | "scheduled_date">;
}): Promise<{ ok: true; copy: FullCopy } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const { settings } = input.context;
  const langs = settings.languages;
  const platforms = input.post.platforms?.length
    ? input.post.platforms
    : ["linkedin", "instagram"];

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
    system: `You write social posts for WIDE, a Munich branding/growth studio, for this client's channels.
Output ONLY JSON with this shape:
{
  "captions": { "<platform>": { "<lang>": "full caption INCLUDING hashtags at the end" } },
  "visual_brief": { "background": "", "graphic_description": "", "style_notes": "", "animation_mechanics": "", "typography_notes": "" },
  "voiceover_script": { "<lang>": "..." },
  "story_repost": { "strategy_text": "", "sticker_type": "poll|tap_link|dm|question|none" },
  "ad_status": "organic",
  "visual_format": "feed|reel"
}
Rules:
- Platforms: ${platforms.join(", ")}. Languages: ${langs.join(", ")}.
- LinkedIn: ${settings.platform_personas.linkedin || "formal third person"}
- Instagram: ${settings.platform_personas.instagram || "first-person companion"}
- Put hashtags INSIDE each caption (end of text). Do NOT return a separate hashtags object.
- LinkedIn captions: 80–180 words, short paragraphs, one CTA with [LINK], then 3–6 hashtags.
- Instagram captions: 1–4 short lines, companion voice, then 3–6 hashtags.
- visual_format: "feed" for static 4:3 1350×1080 posts; "reel" for 9:16 1080×1920 video. LinkedIn uses the same sizes as Instagram.
- Visual brief is production-ready (BG, graphic, style). animation_mechanics and typography_notes only if video=${input.post.is_video} or format=reel.
- Voiceover only if reel/video; otherwise empty object.
- Story repost is a 1–2 sentence plan for the Instagram story that sits WITH this post, plus sticker type.
- Stay on pillar "${input.post.pillar}" and the approved hook. Do not invent client facts that contradict context.
- Match the density and structure of a Sign2x-style mastersheet row.`,
    prompt: `Date: ${input.post.scheduled_date}
Pillar: ${input.post.pillar}
Hook/angle (APPROVED — do not change the idea): ${input.post.hook_angle}
Video: ${input.post.is_video}

CONTEXT:\n${input.context.text}`,
    maxOutputTokens: 3500,
  });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Copy generation failed." };
  }

  if (!json || typeof json !== "object") {
    return { ok: false, error: "Model returned empty copy." };
  }
  const raw = json as any;
  const captions: Record<string, Record<string, string>> = raw.captions || {};
  // Merge any legacy separate hashtags into captions.
  const tags: Record<string, Record<string, string>> = raw.hashtags || {};
  for (const [plat, langsMap] of Object.entries(tags)) {
    captions[plat] = captions[plat] || {};
    for (const [lang, tagStr] of Object.entries(langsMap || {})) {
      const t = String(tagStr || "").trim();
      if (!t) continue;
      const c = String(captions[plat][lang] || "").trim();
      captions[plat][lang] = c ? (c.includes(t) ? c : `${c}\n\n${t}`) : t;
    }
  }
  const visual_format =
    raw.visual_format === "reel" || input.post.is_video ? "reel" : "feed";
  return {
    ok: true,
    copy: {
      captions,
      hashtags: {},
      visual_brief: raw.visual_brief || {},
      voiceover_script: raw.voiceover_script || {},
      story_repost: raw.story_repost || null,
      ad_status: raw.ad_status === "paid" ? "paid" : "organic",
      visual_format,
    },
  };
}

export async function generateSingleAngle(input: {
  context: AssembledContext;
  post: Pick<ContentPost, "scheduled_date" | "platforms" | "pillar" | "is_video">;
  note?: string;
}): Promise<{ ok: true; angle: AnglePlan } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const { settings } = input.context;
  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system: `You are WIDE's social content strategist. Rewrite ONE post angle. Output ONLY JSON:
{ "pillar": string, "hook_angle": string, "is_video": boolean, "platforms": ["linkedin","instagram"] }
Use only these pillars: ${settings.pillars.join(", ")}. hook_angle is ONE strategic sentence.`,
      prompt: `Date: ${input.post.scheduled_date}
Current pillar: ${input.post.pillar || settings.pillars[0]}
Video hint: ${input.post.is_video}
Note: ${input.note || "Give a sharper alternative angle."}

CONTEXT:\n${input.context.text}`,
      maxOutputTokens: 800,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Angle regeneration failed." };
  }
  const raw = json as any;
  const hook = String(raw?.hook_angle || "").trim();
  if (!hook) return { ok: false, error: "Model returned no angle." };
  return {
    ok: true,
    angle: {
      scheduled_date: input.post.scheduled_date,
      platforms:
        Array.isArray(raw.platforms) && raw.platforms.length
          ? raw.platforms.map(String)
          : input.post.platforms,
      pillar: String(raw.pillar || input.post.pillar || settings.pillars[0]),
      hook_angle: hook,
      is_video: typeof raw.is_video === "boolean" ? raw.is_video : input.post.is_video,
    },
  };
}
