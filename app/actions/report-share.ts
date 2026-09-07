"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { getSiteUrl } from "@/lib/site-url";
import { userCanAccessProject } from "@/lib/pdf/access";
import {
  hashSharePassword,
  slugifyReportShare,
  verifySharePassword,
} from "@/lib/reports/share-password";
import {
  REPORT_SHARE_COOKIE,
  REPORT_SHARE_TTL_SEC,
  signShareToken,
  verifyShareToken,
} from "@/lib/reports/share-token";
import {
  listPublishedReportCategories,
  loadShareByProject,
  loadShareBySlug,
  loadSharedReportView,
} from "@/lib/reports/load-share";
import { isReportCategory, type ReportCategory } from "@/lib/reports/categories";
import type { ReportPrintPayload } from "@/lib/reports/load-print-data";

export type ReportSharePublicMeta = {
  slug: string;
  url: string;
  enabled: boolean;
  hasPassword: boolean;
};

async function requireFounderUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." as const, user: null, role: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isFounder(profile?.role)) {
    return { error: "Founders only" as const, user: null, role: null };
  }
  return { error: null, user, role: profile?.role ?? null };
}

export async function getReportShare(
  projectId: string
): Promise<ReportSharePublicMeta | null> {
  const auth = await requireFounderUser();
  if (auth.error || !projectId) return null;
  const row = await loadShareByProject(projectId);
  if (!row) return null;
  return {
    slug: row.publicSlug,
    url: `${getSiteUrl()}/r/${row.publicSlug}`,
    enabled: row.enabled,
    hasPassword: Boolean(row.passwordHash),
  };
}

export async function getClientReportShareUrl(
  projectId: string
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !projectId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const allowed =
    isFounder(profile?.role) ||
    (await userCanAccessProject(user.id, profile?.role ?? null, projectId));
  if (!allowed) return null;
  const row = await loadShareByProject(projectId);
  if (!row?.enabled) return null;
  return `${getSiteUrl()}/r/${row.publicSlug}`;
}

export async function saveReportShare(input: {
  projectId: string;
  password?: string;
  enabled?: boolean;
  slug?: string;
}): Promise<{ ok: true; share: ReportSharePublicMeta } | { ok: false; error: string }> {
  const auth = await requireFounderUser();
  if (auth.error || !auth.user) return { ok: false, error: auth.error || "Sign in required." };

  const admin = createAdminClient();
  const existing = await loadShareByProject(input.projectId);

  const { data: project } = await admin
    .from("projects")
    .select("id, title, client:client_id ( company, name )")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found" };

  const client = Array.isArray(project.client) ? project.client[0] : project.client;
  const org = client?.company || client?.name || project.title || "report";
  let slug = slugifyReportShare(input.slug || existing?.publicSlug || org);
  if (slug !== existing?.publicSlug) {
    const { data: clash } = await admin
      .from("project_report_shares")
      .select("id")
      .eq("public_slug", slug)
      .neq("project_id", input.projectId)
      .maybeSingle();
    if (clash) slug = `${slug}-${input.projectId.slice(0, 6).toLowerCase()}`;
  }

  const password = input.password?.trim() || "";
  if (!existing && password.length < 4) {
    return { ok: false, error: "Set a password of at least 4 characters to create the public link." };
  }
  if (password && password.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters." };
  }

  const enabled = input.enabled ?? existing?.enabled ?? true;
  const passwordHash = password
    ? hashSharePassword(password)
    : existing?.passwordHash;
  if (!passwordHash) {
    return { ok: false, error: "A password is required." };
  }

  const { error } = await admin.from("project_report_shares").upsert(
    {
      project_id: input.projectId,
      public_slug: slug,
      password_hash: passwordHash,
      enabled,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    },
    { onConflict: "project_id" }
  );
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    share: {
      slug,
      url: `${getSiteUrl()}/r/${slug}`,
      enabled,
      hasPassword: true,
    },
  };
}

export async function unlockReportShare(
  slug: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await loadShareBySlug(slug);
  if (!row || !row.enabled) return { ok: false, error: "This report link is not active." };
  if (!verifySharePassword(password, row.passwordHash)) {
    return { ok: false, error: "Wrong password." };
  }
  const token = signShareToken(row.publicSlug, row.projectId);
  const jar = await cookies();
  jar.set(REPORT_SHARE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REPORT_SHARE_TTL_SEC,
  });
  return { ok: true };
}

export async function readUnlockedShare(
  slug: string
): Promise<{ projectId: string } | null> {
  const jar = await cookies();
  const payload = verifyShareToken(jar.get(REPORT_SHARE_COOKIE)?.value);
  if (!payload || payload.slug !== slug) return null;
  const row = await loadShareBySlug(slug);
  if (!row || !row.enabled || row.projectId !== payload.projectId) return null;
  return { projectId: row.projectId };
}

export async function loadUnlockedSharedReport(
  slug: string,
  category: string
): Promise<
  | {
      ok: true;
      projectId: string;
      published: ReportCategory[];
      data: ReportPrintPayload;
    }
  | { ok: false; error: string }
> {
  const unlocked = await readUnlockedShare(slug);
  if (!unlocked) return { ok: false, error: "locked" };
  const published = await listPublishedReportCategories(unlocked.projectId);
  const cat: ReportCategory = isReportCategory(category)
    ? category
    : published[0] || "General";
  const chosen = published.includes(cat) ? cat : published[0];
  if (!chosen) return { ok: false, error: "empty" };
  const data = await loadSharedReportView(unlocked.projectId, chosen);
  if (!data) return { ok: false, error: "empty" };
  return { ok: true, projectId: unlocked.projectId, published, data };
}
