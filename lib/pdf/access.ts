import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";

export async function userCanAccessProject(
  userId: string,
  role: string | null,
  projectId: string
): Promise<boolean> {
  if (isFounder(role)) return true;
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.client_id) return false;
  const { data: mem } = await admin
    .from("company_members")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", project.client_id)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(mem);
}

export async function userCanAccessPublishedSlug(
  userId: string | null,
  role: string | null,
  slug: string
): Promise<{ ok: boolean; projectId?: string; published: boolean }> {
  const admin = createAdminClient();
  const { data: gl } = await admin
    .from("ci_guidelines")
    .select("project_id, status, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!gl) return { ok: false, published: false };
  if (gl.status === "published") return { ok: true, projectId: gl.project_id, published: true };
  if (!userId) return { ok: false, projectId: gl.project_id, published: false };
  const allowed = await userCanAccessProject(userId, role, gl.project_id);
  return { ok: allowed, projectId: gl.project_id, published: false };
}
