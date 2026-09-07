import { google } from "googleapis";
import { writeCurrentDataset } from "@/lib/reports/sync/write-dataset";
import { getGoogleAuthFromConnection, isoDaysAgo } from "@/lib/reports/sync/google-auth";
import type { ProjectConnection } from "@/lib/reports/sync/google";

function isoDurationToSeconds(iso: string | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

export async function listYouTubeChannels(conn: ProjectConnection & { refresh_token?: string | null; access_token?: string | null }) {
  const auth = await getGoogleAuthFromConnection(conn);
  const yt = google.youtube({ version: "v3", auth: auth as never });
  const res = await yt.channels.list({
    mine: true,
    part: ["id", "snippet"],
    maxResults: 50,
  });
  return (res.data.items ?? [])
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id as string,
      label: c.snippet?.title || (c.id as string),
    }));
}

export async function syncYouTube(
  projectId: string,
  connection: ProjectConnection & { refresh_token?: string | null; access_token?: string | null },
  createdBy?: string | null
): Promise<{ streams: string[]; rows: number }> {
  const auth = await getGoogleAuthFromConnection(connection);
  const yt = google.youtube({ version: "v3", auth: auth as never });
  const yta = google.youtubeAnalytics({ version: "v2", auth: auth as never });

  let channelId = connection.external_account_id;
  let label = connection.external_account_label;
  if (!channelId) {
    const mine = await listYouTubeChannels(connection);
    if (!mine.length) throw new Error("This Google account has no YouTube channel.");
    channelId = mine[0].id;
    label = mine[0].label;
  }

  const startDate = isoDaysAgo(90);
  const endDate = isoDaysAgo(1);
  const ids = `channel==${channelId}`;

  const videoMetrics = [
    "views",
    "estimatedMinutesWatched",
    "subscribersGained",
    "averageViewDuration",
    "impressions",
    "impressionClickThroughRate",
  ];
  const dayMetrics = ["views", "estimatedMinutesWatched", "subscribersGained"];

  let videoReport;
  try {
    videoReport = await yta.reports.query({
      ids,
      startDate,
      endDate,
      dimensions: "video",
      metrics: videoMetrics.join(","),
      maxResults: 50,
      sort: "-views",
    });
  } catch {
    videoReport = await yta.reports.query({
      ids,
      startDate,
      endDate,
      dimensions: "video",
      metrics: "views,estimatedMinutesWatched,subscribersGained,averageViewDuration",
      maxResults: 50,
      sort: "-views",
    });
  }

  const videoIds = (videoReport.data.rows ?? [])
    .map((r) => String(r[0] ?? ""))
    .filter(Boolean);

  const titles = new Map<string, { title: string; published: string; duration: number }>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const details = await yt.videos.list({
      id: chunk,
      part: ["snippet", "contentDetails"],
      maxResults: 50,
    });
    for (const v of details.data.items ?? []) {
      if (!v.id) continue;
      titles.set(v.id, {
        title: v.snippet?.title || v.id,
        published: v.snippet?.publishedAt || "",
        duration: isoDurationToSeconds(v.contentDetails?.duration || undefined),
      });
    }
  }

  const hasImpressions = (videoReport.data.columnHeaders ?? []).some(
    (h) => h.name === "impressions"
  );

  const tableRows: Record<string, unknown>[] = (videoReport.data.rows ?? []).map((r) => {
    const id = String(r[0] ?? "");
    const meta = titles.get(id);
    const views = Number(r[1] ?? 0);
    const minutes = Number(r[2] ?? 0);
    const subs = Number(r[3] ?? 0);
    const avgDur = Number(r[4] ?? 0);
    const impressions = hasImpressions ? Number(r[5] ?? 0) : 0;
    const ctr = hasImpressions ? Number(r[6] ?? 0) : 0;
    return {
      content: id,
      "video title": meta?.title || id,
      "video publish time": meta?.published || "",
      duration: meta?.duration || 0,
      views,
      "watch time (hours)": Number((minutes / 60).toFixed(2)),
      subscribers: subs,
      "average view duration": avgDur,
      impressions,
      "impressions click-through rate(%)": ctr <= 1 ? ctr * 100 : ctr,
    };
  });

  const dayReport = await yta.reports.query({
    ids,
    startDate,
    endDate,
    dimensions: "day",
    metrics: dayMetrics.join(","),
  });

  const chartRows: Record<string, unknown>[] = (dayReport.data.rows ?? []).map((r) => ({
    date: String(r[0] ?? ""),
    views: Number(r[1] ?? 0),
    content: channelId,
    "video title": label || "Channel",
  }));

  const account = label || channelId;
  await writeCurrentDataset({
    projectId,
    name: `YouTube · videos · ${account}`,
    category: "Social",
    subcategory: "youtube_table",
    rows: tableRows,
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: account,
    createdBy,
  });
  await writeCurrentDataset({
    projectId,
    name: `YouTube · daily · ${account}`,
    category: "Social",
    subcategory: "youtube_chart",
    rows: chartRows,
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: account,
    createdBy,
  });

  return {
    streams: ["youtube_table", "youtube_chart"],
    rows: tableRows.length + chartRows.length,
  };
}
