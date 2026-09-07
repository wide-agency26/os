"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { resolvePortalViewer } from "@/lib/client/portal-viewer";
import { applyMemberNavAccess, type PortalAccessLevel } from "@/lib/client/permissions";
import {
  CLIENT_NAV_HREF,
  CLIENT_NAV_KEYS,
  emptyClientNavFlags,
  firstEnabledClientHref,
  parseClientNavTabs,
  type ClientNavAvailability,
  type ClientNavKey,
  type ClientNavState,
  unionClientNavTabs,
} from "@/lib/client/nav";
import {
  isProgressPublished,
  parseProjectProgress,
} from "@/lib/client/progress";
import { redirect } from "next/navigation";

const EMPTY: ClientNavAvailability = emptyClientNavFlags(false);
const ALL_OPEN: ClientNavAvailability = emptyClientNavFlags(true);

async function hasRow(
  query: PromiseLike<{ data: unknown[] | null }>
): Promise<boolean> {
  const { data } = await query;
  return Boolean(data && data.length > 0);
}

async function loadCompanyIdsForPortal(): Promise<{
  founderAll: boolean;
  companyIds: string[];
  portalAccess: PortalAccessLevel;
  allowedNavTabs: ClientNavKey[] | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { founderAll: false, companyIds: [], portalAccess: "full", allowedNavTabs: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const viewer = await resolvePortalViewer(supabase as any, {
    userId: user.id,
    role: profile?.role ?? null,
  });

  if (viewer.staff && !viewer.preview) {
    return { founderAll: true, companyIds: [], portalAccess: "full", allowedNavTabs: null };
  }

  return {
    founderAll: false,
    companyIds: viewer.companyIds,
    portalAccess: viewer.portalAccess,
    allowedNavTabs: viewer.allowedNavTabs,
  };
}

export async function getClientNavState(): Promise<ClientNavState> {
  const { founderAll, companyIds, portalAccess, allowedNavTabs } =
    await loadCompanyIdsForPortal();
  if (founderAll) return { enabled: ALL_OPEN, ready: ALL_OPEN };
  if (!companyIds.length) return { enabled: EMPTY, ready: EMPTY };

  const admin = createAdminClient();
  const { data: projects } = await admin
    .from("projects")
    .select("id, client_nav_tabs, client_progress")
    .eq("client_visible", true)
    .in("client_id", companyIds);
  const projectIds = (projects ?? []).map((p) => p.id);
  const enabledSet = unionClientNavTabs(projects ?? []);
  const enabled = emptyClientNavFlags(false);
  for (const key of enabledSet) enabled[key] = true;

  const progressReady = (projects ?? []).some((p) =>
    isProgressPublished(parseProjectProgress(p.id as string, p.client_progress))
  );
  // Progress is not a sidebar checkbox — auto-enable when a published snapshot exists.
  if (progressReady) enabled.progress = true;

  const [
    guidelines,
    reports,
    seo,
    content,
    blog,
    tasks,
    sow,
  ] = await Promise.all([
    projectIds.length
      ? hasRow(
          admin
            .from("ci_guidelines")
            .select("id")
            .eq("status", "published")
            .not("slug", "is", null)
            .in("project_id", projectIds)
            .limit(1)
        )
      : Promise.resolve(false),
    projectIds.length
      ? hasRow(
          admin
            .from("published_reports")
            .select("id")
            .eq("status", "published")
            .in("project_id", projectIds)
            .limit(1)
        )
      : Promise.resolve(false),
    hasRow(
      admin
        .from("seo_sites")
        .select("id")
        .eq("is_client_visible", true)
        .in("company_id", companyIds)
        .limit(1)
    ),
    projectIds.length
      ? hasRow(
          admin
            .from("content_calendars")
            .select("id")
            .in("status", ["in_review", "approved"])
            .in("project_id", projectIds)
            .limit(1)
        )
      : Promise.resolve(false),
    projectIds.length
      ? hasRow(
          admin
            .from("blog_articles")
            .select("id")
            .eq("client_visible", true)
            .in("project_id", projectIds)
            .limit(1)
        )
      : Promise.resolve(false),
    projectIds.length
      ? hasRow(
          admin
            .from("pm_tasks")
            .select("id")
            .eq("client_visible", true)
            .neq("status", "cancelled")
            .in("project_id", projectIds)
            .limit(1)
        )
      : Promise.resolve(false),
    hasRow(
      admin
        .from("sows")
        .select("id")
        .eq("status", "published")
        .in("company_id", companyIds)
        .limit(1)
    ),
  ]);

  const ready: ClientNavAvailability = applyMemberNavAccess(
    {
      progress: enabled.progress && progressReady,
      guidelines: enabled.guidelines && guidelines,
      reports: enabled.reports && reports,
      seo: enabled.seo && seo,
      content: enabled.content && content,
      blog: enabled.blog && blog,
      tasks: enabled.tasks && tasks,
      sow: enabled.sow && sow,
      files: false,
    },
    portalAccess,
    allowedNavTabs
  );
  const gated = applyMemberNavAccess(enabled, portalAccess, allowedNavTabs);

  return { enabled: gated, ready };
}

export async function getClientNavAvailability(): Promise<ClientNavAvailability> {
  const state = await getClientNavState();
  return state.ready;
}

export async function requireEnabledClientNav(key: ClientNavKey): Promise<void> {
  const state = await getClientNavState();
  if (state.enabled[key]) return;
  const anyOn = CLIENT_NAV_KEYS.some((k) => k !== "files" && state.enabled[k]);
  if (!anyOn) return;
  const dest = firstEnabledClientHref(state.enabled);
  if (dest === CLIENT_NAV_HREF[key]) return;
  redirect(dest);
}

export async function loadProjectClientNav(projectId: string): Promise<{
  error?: string;
  clientVisible: boolean;
  tabs: ClientNavKey[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required.", clientVisible: true, tabs: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isFounder(profile?.role)) {
    return { error: "Founder access required.", clientVisible: true, tabs: [] };
  }

  const { data, error } = await supabase
    .from("projects")
    .select("client_visible, client_nav_tabs")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message || "Project not found.", clientVisible: true, tabs: [] };
  }
  return {
    clientVisible: data.client_visible !== false,
    tabs: parseClientNavTabs(data.client_nav_tabs as string[] | null),
  };
}

export async function setProjectClientNav(
  projectId: string,
  input: { clientVisible?: boolean; tabs?: ClientNavKey[] }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isFounder(profile?.role)) return { ok: false, error: "Founder access required." };

  const patch: { client_visible?: boolean; client_nav_tabs?: string[]; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (input.clientVisible !== undefined) patch.client_visible = input.clientVisible;
  if (input.tabs) {
    patch.client_nav_tabs = input.tabs.filter((k) => k !== "files" && k !== "progress");
  }

  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
