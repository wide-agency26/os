"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { resolvePortalViewer } from "@/lib/client/portal-viewer";
import {
  isProgressPublished,
  parseProjectProgress,
  type ProjectProgress,
} from "@/lib/client/progress";

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." as const, supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isFounder(profile?.role)) {
    return { error: "Founder access required." as const, supabase, user: null, profile: null };
  }
  return { error: null, supabase, user, profile };
}

async function resolvePublisherId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data: person } = await supabase
    .from("people")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return person?.id || userId;
}

async function publisherLabel(publishedBy: string | null): Promise<string | null> {
  if (!publishedBy) return null;
  const admin = createAdminClient();
  const { data: person } = await admin
    .from("people")
    .select("full_name")
    .eq("id", publishedBy)
    .maybeSingle();
  if (person?.full_name) return person.full_name as string;
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", publishedBy)
    .maybeSingle();
  return (profile?.full_name || null) as string | null;
}

export async function loadProjectProgress(projectId: string): Promise<{
  error?: string;
  progress: ProjectProgress;
  publisherName: string | null;
}> {
  const auth = await requireFounder();
  if (auth.error || !auth.supabase) {
    const { emptyProjectProgress } = await import("@/lib/client/progress");
    return {
      error: auth.error || "Sign in required.",
      progress: emptyProjectProgress(projectId),
      publisherName: null,
    };
  }

  const { data, error } = await auth.supabase
    .from("projects")
    .select("id, client_progress")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    const { emptyProjectProgress } = await import("@/lib/client/progress");
    return {
      error: error?.message || "Project not found.",
      progress: emptyProjectProgress(projectId),
      publisherName: null,
    };
  }

  const progress = parseProjectProgress(projectId, data.client_progress);
  const publisherName = await publisherLabel(progress.published_by);
  return { progress, publisherName };
}

export async function publishProjectProgress(
  projectId: string,
  input: ProjectProgress
): Promise<{ ok: boolean; error?: string; progress?: ProjectProgress; publisherName?: string | null }> {
  const auth = await requireFounder();
  if (auth.error || !auth.user || !auth.supabase) {
    return { ok: false, error: auth.error || "Sign in required." };
  }

  const now = new Date().toISOString();
  const publishedBy = await resolvePublisherId(auth.supabase, auth.user.id);
  const progress = parseProjectProgress(projectId, {
    ...input,
    project_id: projectId,
    published_at: now,
    published_by: publishedBy,
    updated_at: now,
  });

  const { error } = await auth.supabase
    .from("projects")
    .update({
      client_progress: progress,
      updated_at: now,
    })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/projects/${projectId}/portal`);
  revalidatePath("/app/client-progress");
  revalidatePath("/api/client/nav-availability");

  const publisherName = await publisherLabel(publishedBy);
  return { ok: true, progress, publisherName };
}

/** Published snapshot for the client portal — never returns draft-only data. */
export async function loadClientProgressForPortal(projectId: string): Promise<{
  error?: string;
  progress: ProjectProgress | null;
  empty: boolean;
  publisherName: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required.", progress: null, empty: true, publisherName: null };
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id, client_id, client_visible, client_progress")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    return {
      error: error?.message || "Project not found.",
      progress: null,
      empty: true,
      publisherName: null,
    };
  }

  if (data.client_visible === false) {
    return { progress: null, empty: true, publisherName: null };
  }

  if (!viewer.staff || viewer.preview) {
    if (!data.client_id || !viewer.companyIds.includes(data.client_id as string)) {
      return { error: "No access to this project.", progress: null, empty: true, publisherName: null };
    }
  }

  const progress = parseProjectProgress(projectId, data.client_progress);
  if (!isProgressPublished(progress)) {
    return { progress: null, empty: true, publisherName: null };
  }

  const publisherName = await publisherLabel(progress.published_by);
  return { progress, empty: false, publisherName };
}
