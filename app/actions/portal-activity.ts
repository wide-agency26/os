"use server";

import { createClient } from "@/utils/supabase/server";
import { getWorkspaceClientId } from "@/lib/workspace";
import { isFounder, isClient, userTier } from "@/lib/rbac";
import { readViewAsCompanyId } from "@/lib/client/view-as.server";
import {
  activityTitle,
  describePath,
  isClientFacingPath,
  isUuid,
  type ActivityEventType,
  type ActorRole,
} from "@/lib/activity/surfaces";
import type { Json } from "@/types/supabase";

const DEDUPE_MS = 60_000;

async function actorContext(opts: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  role: string | null;
  path: string;
}): Promise<{
  actorRole: ActorRole;
  companyId: string | null;
  clientId: string;
}> {
  const workspaceId = await getWorkspaceClientId(opts.supabase, opts.userId);
  const viewAsCompany = await readViewAsCompanyId();
  const staff = isFounder(opts.role);

  if (staff) {
    const preview = Boolean(viewAsCompany) || isClientFacingPath(opts.path);
    return {
      actorRole: preview ? "view_as" : "staff",
      companyId: viewAsCompany,
      clientId: workspaceId,
    };
  }

  if (isClient(opts.role)) {
    const { data: members } = await opts.supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", opts.userId)
      .eq("status", "active")
      .limit(1);
    return {
      actorRole: "client",
      companyId: members?.[0]?.company_id ?? null,
      clientId: opts.userId,
    };
  }

  return {
    actorRole: userTier(opts.role) === "prospect" ? "prospect" : "staff",
    companyId: null,
    clientId: workspaceId,
  };
}

async function insertActivity(row: {
  clientId: string;
  actorId: string;
  actorRole: ActorRole;
  eventType: ActivityEventType;
  title: string;
  companyId: string | null;
  projectId: string | null;
  surface: string;
  path: string | null;
  resourceId: string | null;
  sessionId: string | null;
  meta?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const payload = {
    client_id: row.clientId,
    actor_id: row.actorId,
    actor_role: row.actorRole,
    event_type: row.eventType,
    title: row.title,
    company_id: row.companyId,
    project_id: row.projectId,
    surface: row.surface,
    path: row.path,
    resource_id: row.resourceId,
    session_id: row.sessionId,
    meta: (row.meta ?? {}) as Json,
  };
  const { error } = await supabase.from("portal_activity").insert(payload as never);
  if (error) {
    console.error("[activity] insert failed", error.message);
  }
}

export async function logPortalActivity(
  clientId: string,
  eventType: string,
  title: string,
  meta?: Record<string, unknown>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const ctx = await actorContext({
    supabase,
    userId: user.id,
    role: profile?.role ?? null,
    path: "/",
  });

  await insertActivity({
    clientId,
    actorId: user.id,
    actorRole: ctx.actorRole,
    eventType: (eventType as ActivityEventType) || "page_view",
    title,
    companyId: ctx.companyId,
    projectId: null,
    surface: "other",
    path: null,
    resourceId: null,
    sessionId: null,
    meta,
  });
}

export async function recordPageView(input: {
  path: string;
  sessionId?: string | null;
}) {
  const path = (input.path || "").split("?")[0];
  if (!path.startsWith("/app")) return { recorded: false as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { recorded: false as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const described = describePath(path);
  const since = new Date(Date.now() - DEDUPE_MS).toISOString();
  const { data: recent } = await supabase
    .from("portal_activity")
    .select("id")
    .eq("actor_id", user.id)
    .eq("path", path)
    .eq("event_type", described.eventType)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (recent) return { recorded: false as const, deduped: true };

  const ctx = await actorContext({
    supabase,
    userId: user.id,
    role: profile?.role ?? null,
    path,
  });

  const projectId =
    described.projectId && isUuid(described.projectId) ? described.projectId : null;

  await insertActivity({
    clientId: ctx.clientId,
    actorId: user.id,
    actorRole: ctx.actorRole,
    eventType: described.eventType,
    title: activityTitle(described.eventType, described.surface),
    companyId: ctx.companyId,
    projectId,
    surface: described.surface,
    path,
    resourceId: described.resourceId,
    sessionId: input.sessionId ?? null,
  });

  if (ctx.actorRole === "client" || ctx.actorRole === "view_as") {
    await touchLastPortalVisit();
  }

  return { recorded: true as const };
}

export async function touchLastPortalVisit() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: row, error: readErr } = await supabase
    .from("profiles")
    .select("last_portal_visit")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) return;

  const last = row?.last_portal_visit
    ? new Date(row.last_portal_visit as string).getTime()
    : 0;
  if (Date.now() - last < 60 * 60 * 1000) return;

  await supabase
    .from("profiles")
    .update({
      last_portal_visit: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
}

export async function recordVaultDownload(fileId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: file } = await supabase
    .from("vault_files")
    .select("client_id, label, external_url")
    .eq("id", fileId)
    .maybeSingle();

  if (!file) return;

  await supabase.from("vault_downloads").insert({
    file_id: fileId,
    user_id: user.id,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const ctx = await actorContext({
    supabase,
    userId: user.id,
    role: profile?.role ?? null,
    path: "/app/client-files",
  });

  const openedExternal = Boolean(file.external_url);
  const eventType: ActivityEventType = openedExternal
    ? "file_opened"
    : "file_download";

  await insertActivity({
    clientId: (file.client_id as string) || ctx.clientId,
    actorId: user.id,
    actorRole: ctx.actorRole,
    eventType,
    title: activityTitle(eventType, "files"),
    companyId: ctx.companyId,
    projectId: null,
    surface: "files",
    path: "/app/client-files",
    resourceId: fileId,
    sessionId: null,
    meta: { file_id: fileId, external: openedExternal },
  });
}

export type ActivitySummary = {
  windowDays: number;
  since: string;
  client: {
    uniqueActors: number;
    events: number;
    bySurface: Record<string, number>;
  };
  viewAs: {
    events: number;
  };
  staff: {
    uniqueActors: number;
    events: number;
  };
  companies: Array<{
    companyId: string;
    companyName: string;
    clientEvents: number;
    lastSeen: string;
  }>;
};

export async function getActivitySummary(
  windowDays = 14
): Promise<ActivitySummary | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { error: "Founders only." };
  }

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("portal_activity")
    .select("actor_id, actor_role, surface, company_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return { error: error.message };

  const list = (rows ?? []) as Array<{
    actor_id: string | null;
    actor_role: string | null;
    surface: string | null;
    company_id: string | null;
    created_at: string;
  }>;

  const clientRows = list.filter((r) => r.actor_role === "client");
  const viewAsRows = list.filter((r) => r.actor_role === "view_as");
  const staffRows = list.filter((r) => r.actor_role === "staff");

  const bySurface: Record<string, number> = {};
  for (const r of clientRows) {
    const s = r.surface || "other";
    bySurface[s] = (bySurface[s] || 0) + 1;
  }

  const companyLast = new Map<
    string,
    { events: number; lastSeen: string }
  >();
  for (const r of clientRows) {
    if (!r.company_id) continue;
    const prev = companyLast.get(r.company_id);
    if (!prev) {
      companyLast.set(r.company_id, { events: 1, lastSeen: r.created_at });
    } else {
      prev.events += 1;
      if (r.created_at > prev.lastSeen) prev.lastSeen = r.created_at;
    }
  }

  const companyIds = [...companyLast.keys()];
  const names = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies } = await supabase
      .from("crm_customers")
      .select("id, company, name")
      .in("id", companyIds);
    for (const c of companies ?? []) {
      names.set(
        c.id as string,
        String((c as { company?: string; name?: string }).company || (c as { name?: string }).name || "Company")
      );
    }
  }

  return {
    windowDays,
    since,
    client: {
      uniqueActors: new Set(clientRows.map((r) => r.actor_id).filter(Boolean)).size,
      events: clientRows.length,
      bySurface,
    },
    viewAs: { events: viewAsRows.length },
    staff: {
      uniqueActors: new Set(staffRows.map((r) => r.actor_id).filter(Boolean)).size,
      events: staffRows.length,
    },
    companies: [...companyLast.entries()]
      .map(([companyId, v]) => ({
        companyId,
        companyName: names.get(companyId) || "Company",
        clientEvents: v.events,
        lastSeen: v.lastSeen,
      }))
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
  };
}
