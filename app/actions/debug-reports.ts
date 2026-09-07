"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { persistDebugReport } from "@/lib/debug/persist";
import type {
  DebugAttachment,
  DebugReportInput,
  DebugSeverity,
  DebugStatus,
} from "@/lib/debug/types";

export type DebugReportRow = {
  id: string;
  created_at: string;
  updated_at: string;
  reporter_id: string;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_role: string | null;
  status: DebugStatus;
  severity: DebugSeverity;
  report_type?: "bug" | "enhancement";
  title: string;
  what_happened: string;
  expected: string | null;
  actual: string | null;
  before_experience: string | null;
  after_experience: string | null;
  repro_steps: string | null;
  project_id?: string | null;
  href: string | null;
  pathname: string | null;
  search: string | null;
  hash: string | null;
  page_title: string | null;
  tab_label: string | null;
  location_label: string | null;
  view_as_company_id: string | null;
  view_as_company_name: string | null;
  view_as_contact_name: string | null;
  viewing_as_client: boolean;
  context: Record<string, unknown>;
  agent_brief: string;
  attachments: DebugAttachment[];
  attachment_urls?: { name: string; url: string; mime: string }[];
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
};

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, error: "Not signed in" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { supabase, user: null, profile: null, error: "Founders only" };
  }
  return { supabase, user, profile, error: null as string | null };
}

function asContext(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asAttachments(value: unknown): DebugAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: DebugAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const path = typeof rec.path === "string" ? rec.path : "";
    const name = typeof rec.name === "string" ? rec.name : "image";
    const mime = typeof rec.mime === "string" ? rec.mime : "image/png";
    const size = typeof rec.size === "number" ? rec.size : 0;
    if (!path) continue;
    out.push({ path, name, mime, size });
  }
  return out;
}

const ATTACH_BUCKET = "debug-attachments";
const MAX_ATTACH = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function uploadDebugAttachments(
  formData: FormData
): Promise<
  { ok: true; attachments: DebugAttachment[] } | { ok: false; error: string }
> {
  const gate = await requireFounder();
  if (gate.error || !gate.user) return { ok: false, error: gate.error || "Not signed in" };

  const files = formData.getAll("files");
  if (files.length > MAX_ATTACH) {
    return { ok: false, error: "Up to 5 images." };
  }

  const admin = createAdminClient();
  const attachments: DebugAttachment[] = [];

  for (const entry of files) {
    if (!(entry instanceof Blob)) continue;
    const mime = entry.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return { ok: false, error: "Images only (PNG, JPEG, WebP, GIF)." };
    }
    if (entry.size > MAX_BYTES) {
      return { ok: false, error: "Each image must be 5 MB or smaller." };
    }
    const original =
      "name" in entry && typeof (entry as File).name === "string"
        ? (entry as File).name
        : "image.png";
    const safe = original.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const path = `${gate.user.id}/${crypto.randomUUID()}-${safe}`;
    const buf = Buffer.from(await entry.arrayBuffer());
    const { error } = await admin.storage.from(ATTACH_BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    });
    if (error) return { ok: false, error: error.message };
    attachments.push({ path, name: original.slice(0, 180), mime, size: entry.size });
  }

  return { ok: true, attachments };
}

export async function submitDebugReport(
  input: DebugReportInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await persistDebugReport(input);
  if (result.ok) revalidatePath("/app/debug-center");
  return result;
}

export async function listDebugReports(opts?: {
  includeResolved?: boolean;
  includeHidden?: boolean;
}): Promise<{ ok: true; reports: DebugReportRow[] } | { ok: false; error: string }> {
  const gate = await requireFounder();
  if (gate.error) return { ok: false, error: gate.error };

  const { data, error } = await gate.supabase
    .from("debug_reports" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: error.message };

  const admin = createAdminClient();
  let rows = await Promise.all(
    ((data || []) as unknown as DebugReportRow[]).map(async (r) => {
      const attachments = asAttachments(r.attachments);
      const attachment_urls: { name: string; url: string; mime: string }[] = [];
      for (const a of attachments) {
        const { data: signed } = await admin.storage
          .from(ATTACH_BUCKET)
          .createSignedUrl(a.path, 3600);
        if (signed?.signedUrl) {
          attachment_urls.push({
            name: a.name,
            url: signed.signedUrl,
            mime: a.mime,
          });
        }
      }
      return {
        ...r,
        context: asContext(r.context),
        attachments,
        attachment_urls,
      };
    })
  );
  if (!opts?.includeHidden) rows = rows.filter((r) => r.status !== "hidden");
  if (!opts?.includeResolved) {
    rows = rows.filter((r) => r.status !== "resolved");
  }
  return { ok: true, reports: rows };
}

export async function updateDebugReportStatus(
  id: string,
  status: DebugStatus,
  resolutionNote?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireFounder();
  if (gate.error || !gate.user) return { ok: false, error: gate.error || "Not signed in" };

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "resolved" || status === "hidden") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = gate.user.id;
    if (resolutionNote?.trim()) patch.resolution_note = resolutionNote.trim();
  }
  if (status === "open" || status === "in_progress") {
    patch.resolved_at = null;
    patch.resolved_by = null;
  }

  const { error } = await gate.supabase
    .from("debug_reports" as never)
    .update(patch as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/debug-center");
  return { ok: true };
}
