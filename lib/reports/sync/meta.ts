import { createAdminClient } from "@/utils/supabase/admin";
import { writeCurrentDataset } from "@/lib/reports/sync/write-dataset";
import { isoDaysAgo } from "@/lib/reports/sync/google-auth";
import type { ProjectConnection } from "@/lib/reports/sync/google";

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaAppConfigured(): boolean {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export async function exchangeMetaCode(
  code: string,
  redirectUri: string,
  appId: string,
  secret: string
) {
  const short = await graphGet<{ access_token: string }>(
    "/oauth/access_token",
    "",
    {
      client_id: appId,
      client_secret: secret,
      redirect_uri: redirectUri,
      code,
    }
  );
  const longLived = await graphGet<{ access_token: string; expires_in?: number }>(
    "/oauth/access_token",
    "",
    {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: secret,
      fb_exchange_token: short.access_token,
    }
  );
  return longLived;
}

async function graphGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = path.startsWith("http") ? new URL(path) : new URL(`${GRAPH}${path}`);
  if (token) url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = (await res.json()) as { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta API ${res.status}`);
  }
  return json as T;
}

async function graphPages(
  path: string,
  token: string,
  params: Record<string, string> = {}
): Promise<unknown[]> {
  const out: unknown[] = [];
  let nextUrl: string | null = path.startsWith("http") ? path : `${GRAPH}${path}`;
  let firstParams = params;
  let pages = 0;
  while (nextUrl && pages < 20) {
    const needsToken = nextUrl.startsWith(GRAPH) && !nextUrl.includes("access_token=");
    const payload = (await graphGet(
      nextUrl,
      needsToken ? token : "",
      pages === 0 ? firstParams : {}
    )) as { data?: unknown[]; paging?: { next?: string } };
    out.push(...(payload.data ?? []));
    nextUrl = payload.paging?.next ?? null;
    firstParams = {};
    pages += 1;
  }
  return out;
}

async function persistIgPreview(
  projectId: string,
  mediaId: string,
  urls: (string | undefined)[]
): Promise<string> {
  const admin = createAdminClient();
  const candidates = urls.filter((u): u is string => !!u && /^https?:\/\//i.test(u));
  for (const url of candidates) {
    if (/\.mp4(\?|$)/i.test(url)) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const type = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (type.startsWith("video/")) continue;
      const looksImage =
        type.startsWith("image/") || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
      if (!looksImage) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = type.includes("png")
        ? "png"
        : type.includes("webp")
          ? "webp"
          : type.includes("gif")
            ? "gif"
            : "jpg";
      const path = `${projectId}/instagram/${mediaId}.${ext}`;
      const { error } = await admin.storage.from("content-context").upload(path, buf, {
        contentType: type.startsWith("image/") ? type : "image/jpeg",
        upsert: true,
      });
      if (error) {
        console.warn("IG preview upload failed", mediaId, error.message);
        continue;
      }
      return admin.storage.from("content-context").getPublicUrl(path).data.publicUrl;
    } catch (err) {
      console.warn("IG preview fetch failed", mediaId, err);
    }
  }
  return candidates.find((u) => !/\.mp4(\?|$)/i.test(u)) || "";
}

function actionValue(actions: { action_type: string; value: string }[] | undefined, types: string[]): number {
  if (!actions) return 0;
  for (const t of types) {
    const hit = actions.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

export async function listMetaAdAccounts(token: string) {
  const data = await graphGet<{ data?: { id: string; name: string }[] }>(
    "/me/adaccounts",
    token,
    { fields: "id,name" }
  );
  return (data.data ?? []).map((a) => ({ id: a.id, label: a.name || a.id }));
}

export async function listInstagramAccounts(token: string) {
  const pages = await graphGet<{
    data?: {
      id: string;
      name: string;
      access_token?: string;
      instagram_business_account?: { id: string };
    }[];
  }>("/me/accounts", token, {
    fields: "id,name,access_token,instagram_business_account",
  });
  return (pages.data ?? [])
    .filter((p) => p.instagram_business_account?.id)
    .map((p) => ({
      id: p.instagram_business_account!.id,
      label: p.name,
      pageToken: p.access_token || token,
    }));
}

export async function syncMetaAds(
  projectId: string,
  connection: ProjectConnection,
  token: string,
  createdBy?: string | null
): Promise<{ streams: string[]; rows: number }> {
  const accountId = connection.external_account_id;
  if (!accountId) throw new Error("Pick a Meta ad account before syncing Ads.");

  const startDate = isoDaysAgo(90);
  const endDate = isoDaysAgo(1);
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  type Insight = {
    date_start?: string;
    campaign_name?: string;
    adset_name?: string;
    ad_name?: string;
    spend?: string;
    impressions?: string;
    reach?: string;
    frequency?: string;
    clicks?: string;
    inline_link_clicks?: string;
    ctr?: string;
    cpc?: string;
    actions?: { action_type: string; value: string }[];
    purchase_roas?: { action_type: string; value: string }[];
  };

  const raw = (await graphPages(
    `/${act}/insights`,
    token,
    {
      fields:
        "date_start,campaign_name,adset_name,ad_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,actions,purchase_roas",
      time_increment: "1",
      level: "ad",
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      limit: "500",
    }
  )) as Insight[];

  const rows: Record<string, unknown>[] = raw.map((r) => {
    const spend = Number(r.spend ?? 0);
    const impressions = Number(r.impressions ?? 0);
    const clicks = Number(r.inline_link_clicks ?? r.clicks ?? 0);
    const landing = actionValue(r.actions, ["landing_page_view"]);
    const results = actionValue(r.actions, [
      "purchase",
      "lead",
      "omni_purchase",
      "complete_registration",
    ]);
    let ctr = Number(r.ctr ?? 0);
    if (ctr > 0 && ctr <= 1) ctr = ctr * 100;
    const roas = Number(r.purchase_roas?.[0]?.value ?? 0);
    return {
      date: r.date_start,
      campaign_name: r.campaign_name || "(not set)",
      adset_name: r.adset_name || "(not set)",
      ad_name: r.ad_name || "(not set)",
      amount_spent: spend,
      impressions,
      reach: Number(r.reach ?? 0),
      frequency: Number(r.frequency ?? 0),
      link_clicks: clicks,
      landing_page_views: landing,
      results,
      ctr,
      cpc: Number(r.cpc ?? 0),
      roas,
    };
  });

  const label = connection.external_account_label || accountId;
  await writeCurrentDataset({
    projectId,
    name: `Meta Ads · ${label}`,
    category: "Ads",
    subcategory: "meta_ads",
    rows,
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: label,
    createdBy,
  });

  return { streams: ["meta_ads"], rows: rows.length };
}

export async function syncInstagram(
  projectId: string,
  connection: ProjectConnection,
  token: string,
  createdBy?: string | null
): Promise<{ streams: string[]; rows: number }> {
  const igUserId = connection.external_account_id;
  if (!igUserId) throw new Error("Pick an Instagram account before syncing Social.");

  const startDate = isoDaysAgo(30);
  const endDate = isoDaysAgo(1);
  const label = connection.external_account_label || igUserId;
  const since = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const until = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);

  let reach = 0;
  let impressions = 0;
  let profileVisits = 0;
  let linkTaps = 0;
  let interactions = 0;

  try {
    const insights = await graphGet<{
      data?: { name: string; values?: { value: number }[] }[];
    }>(`/${igUserId}/insights`, token, {
      metric: "reach,views,profile_views,website_clicks,total_interactions",
      period: "day",
      since: String(since),
      until: String(until),
    });
    for (const m of insights.data ?? []) {
      const sum = (m.values ?? []).reduce((s, v) => s + Number(v.value || 0), 0);
      if (m.name === "reach") reach = sum;
      if (m.name === "views" || m.name === "impressions") impressions = sum;
      if (m.name === "profile_views") profileVisits = sum;
      if (m.name === "website_clicks") linkTaps = sum;
      if (m.name === "total_interactions") interactions = sum;
    }
  } catch (err) {
    console.warn("IG account insights failed:", err);
  }

  const summaryRows: Record<string, unknown>[] = [
    {
      period: `${startDate} – ${endDate}`,
      accounts_reached: reach,
      impressions,
      profile_visits: profileVisits,
      external_link_taps: linkTaps,
      content_interactions: interactions,
      accounts_engaged: 0,
    },
  ];

  type Media = {
    id: string;
    caption?: string;
    timestamp?: string;
    permalink?: string;
    media_url?: string;
    thumbnail_url?: string;
    media_type?: string;
    like_count?: number;
    comments_count?: number;
    children?: { data?: { media_url?: string; thumbnail_url?: string }[] };
  };

  const media = (await graphPages(
    `/${igUserId}/media`,
    token,
    {
      fields:
        "id,caption,timestamp,permalink,media_url,thumbnail_url,media_type,like_count,comments_count,children{media_url,thumbnail_url}",
      limit: "100",
    }
  )) as Media[];

  const postRows: Record<string, unknown>[] = [];
  for (const m of media.slice(0, 80)) {
    let mediaReach = 0;
    let mediaImpr = 0;
    let saves = 0;
    let shares = 0;
    try {
      const ins = await graphGet<{ data?: { name: string; values?: { value: number }[] }[] }>(
        `/${m.id}/insights`,
        token,
        { metric: "reach,views,saved,shares" }
      );
      for (const metric of ins.data ?? []) {
        const v = Number(metric.values?.[0]?.value ?? 0);
        if (metric.name === "reach") mediaReach = v;
        if (metric.name === "views" || metric.name === "impressions") mediaImpr = v;
        if (metric.name === "saved") saves = v;
        if (metric.name === "shares") shares = v;
      }
    } catch {
      // Insights unavailable for some media types (stories/reels variants).
    }
    const child = m.children?.data?.[0];
    const thumbnailUrl = await persistIgPreview(projectId, m.id, [
      m.thumbnail_url,
      m.media_url,
      child?.thumbnail_url,
      child?.media_url,
    ]);
    const format = (m.media_type || "IMAGE").toLowerCase();
    postRows.push({
      _ig_kind: "post",
      media_id: m.id,
      caption: m.caption || "",
      created_at: m.timestamp || "",
      thumbnail_url: thumbnailUrl,
      post_url: m.permalink || "",
      format: format === "carousel_album" ? "carousel" : format === "video" ? "reel" : "post",
      accounts_reached: mediaReach,
      impressions: mediaImpr,
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      saves,
      shares,
    });
  }

  await writeCurrentDataset({
    projectId,
    name: `Instagram · reach · ${label}`,
    category: "Social",
    subcategory: "instagram_profiles_reached",
    rows: summaryRows,
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: label,
    createdBy,
  });

  await writeCurrentDataset({
    projectId,
    name: `Instagram · interactions · ${label}`,
    category: "Social",
    subcategory: "instagram_content_interactions",
    rows: [{ ...summaryRows[0], post_interactions: interactions }],
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: label,
    createdBy,
  });

  await writeCurrentDataset({
    projectId,
    name: `Instagram · posts · ${label}`,
    category: "Social",
    subcategory: "instagram_posts",
    rows: postRows,
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: label,
    createdBy,
  });

  try {
    const { linkLiveInstagramPosts } = await import("@/lib/content/link-live-instagram");
    await linkLiveInstagramPosts(
      projectId,
      postRows.map((r) => ({
        media_id: String(r.media_id || ""),
        caption: String(r.caption || ""),
        created_at: String(r.created_at || ""),
        post_url: String(r.post_url || ""),
        thumbnail_url: String(r.thumbnail_url || ""),
      }))
    );
  } catch {
    // Calendar linking is best-effort; sync data still lands.
  }

  return {
    streams: ["instagram_profiles_reached", "instagram_content_interactions", "instagram_posts"],
    rows: summaryRows.length + postRows.length,
  };
}
