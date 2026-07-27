import { NextResponse } from "next/server";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { createAdminClient } from "@/utils/supabase/admin";

// Simple in-memory token cache for Superset JWT
let cachedToken: string | null = null;
let tokenExpiryTime: number = 0;

async function getSupersetToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiryTime) {
    return cachedToken;
  }

  const supersetUrl = process.env.SUPERSET_URL;
  const username = process.env.SUPERSET_ADMIN_USER;
  const password = process.env.SUPERSET_ADMIN_PASSWORD;

  if (!supersetUrl || !username || !password) {
    throw new Error("Missing Superset environment variables.");
  }

  const authResponse = await fetch(`${supersetUrl}/api/v1/security/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, provider: "db" }),
  });

  if (!authResponse.ok) {
    throw new Error(`Superset auth failed: ${authResponse.statusText}`);
  }

  const data = await authResponse.json();
  cachedToken = data.access_token;
  tokenExpiryTime = now + 5 * 60 * 1000;
  return cachedToken as string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  try {
    const { client_id } = await params;
    await resolveClientReadAccess(client_id);

    const body = await req.json();
    const { startDate, endDate, metricIds } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Missing date range" }, { status: 400 });
    }

    // Try fetching from Apache Superset REST API
    if (process.env.SUPERSET_URL && process.env.SUPERSET_ADMIN_USER) {
      try {
        const token = await getSupersetToken();
        const queryPayload = {
          datasource: { id: 1, type: "table" },
          queries: [
            {
              columns: ["source", "log_date"],
              metrics: metricIds || ["sum__impressions", "sum__clicks", "sum__conversions", "sum__cost"],
              filters: [
                { col: "client_id", op: "==", val: client_id },
                { col: "log_date", op: ">=", val: startDate },
                { col: "log_date", op: "<=", val: endDate },
              ],
              granularity: "log_date",
              time_range: "No filter",
            },
          ],
        };

        const supersetResponse = await fetch(`${process.env.SUPERSET_URL}/api/v1/chart/data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(queryPayload),
        });

        if (supersetResponse.ok) {
          const rawData = await supersetResponse.json();
          const records = rawData?.result?.[0]?.data || [];

          const normalizedMap: Record<string, any> = {};
          for (const row of records) {
            const date = row.log_date;
            const source = (row.source || "unknown").toLowerCase();
            if (!normalizedMap[date]) normalizedMap[date] = { date };

            for (const key of Object.keys(row)) {
              if (key !== "log_date" && key !== "source") {
                normalizedMap[date][`${source}_${key}`] = row[key];
              }
            }
          }

          const normalizedArray = Object.values(normalizedMap).sort(
            (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          return NextResponse.json({ data: normalizedArray, engine: "apache-superset" });
        }
      } catch (supersetErr) {
        console.warn("Superset proxy warning, falling back to Postgres:", supersetErr);
      }
    }

    // Direct Postgres fallback when Superset URL is not configured
    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("marketing_daily_snapshots")
      .select("*")
      .eq("client_id", client_id)
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .order("log_date", { ascending: true });

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const normalizedMap: Record<string, any> = {};
    (rows || []).forEach((row: any) => {
      const date = row.log_date;
      const source = (row.source || "unknown").toLowerCase();
      if (!normalizedMap[date]) normalizedMap[date] = { date };

      normalizedMap[date][`${source}_sum__impressions`] = (normalizedMap[date][`${source}_sum__impressions`] || 0) + (row.impressions || 0);
      normalizedMap[date][`${source}_sum__clicks`] = (normalizedMap[date][`${source}_sum__clicks`] || 0) + (row.clicks || 0);
      normalizedMap[date][`${source}_sum__cost`] = (normalizedMap[date][`${source}_sum__cost`] || 0) + (row.cost || 0);
      normalizedMap[date][`${source}_sum__conversions`] = (normalizedMap[date][`${source}_sum__conversions`] || 0) + (row.conversions || 0);
    });

    const normalizedArray = Object.values(normalizedMap).sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({ data: normalizedArray, engine: "postgres-snapshot-fallback" });
  } catch (error: any) {
    console.error("Fetch Data Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
