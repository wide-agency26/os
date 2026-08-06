"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import {
  defaultLinkFileName,
  inferGoogleProvider,
  normalizeVaultExternalUrl,
} from "@/lib/vault/external-links";
import { createClient } from "@/utils/supabase/server";
import type { Json } from "@/types/supabase";

const VAULT_BUCKET = "client-vault";

function folderFromCategory(category: string): string {
  const c = category.trim().toLowerCase();
  if (c.includes("invoice") || c.includes("legal")) return "legal";
  if (c.includes("final")) return "final-assets";
  if (c.includes("strateg")) return "strategy";
  if (c.includes("wire")) return "wireframes";
  return "general";
}

export type VaultUploadState = { error?: string; success?: string };

async function bumpVaultVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  replaceId: string | null
): Promise<{ version: number; replaces_file_id: string | null }> {
  if (!replaceId) return { version: 1, replaces_file_id: null };
  const { data: prev } = await supabase
    .from("vault_files")
    .select("id, version")
    .eq("id", replaceId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!prev) return { version: 1, replaces_file_id: null };
  const version = (prev.version as number) + 1;
  await supabase.from("vault_files").update({ is_current: false }).eq("id", replaceId);
  return { version, replaces_file_id: replaceId };
}

export async function adminAddVaultExternalLink(
  _prev: VaultUploadState,
  formData: FormData
): Promise<VaultUploadState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) {
    return { error: "Admin access required." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const category = String(formData.get("category") ?? "General").trim() || "General";
  const label = String(formData.get("label") ?? "").trim();
  const replaceId = String(formData.get("replace_file_id") ?? "").trim();
  const rawUrl = String(formData.get("external_url") ?? "").trim();
  const displayName = String(formData.get("link_display_name") ?? "").trim();

  if (!clientId || !label) {
    return { error: "Client and label are required." };
  }

  const external_url = normalizeVaultExternalUrl(rawUrl);
  if (!external_url) {
    return { error: "Paste a valid https link (Google Drive, Docs, Sheets, Slides, or Shared drives)." };
  }

  const supabase = await createClient();
  const { version, replaces_file_id } = await bumpVaultVersion(supabase, clientId, replaceId || null);

  const folder_key = folderFromCategory(category);
  const is_legal = folder_key === "legal" || /invoice|contract/i.test(category);
  const external_provider = inferGoogleProvider(external_url);
  const file_name = defaultLinkFileName(external_url, displayName || null);

  const { error: insErr } = await supabase.from("vault_files").insert({
    client_id: clientId,
    folder_key,
    category,
    label,
    storage_path: null,
    external_url,
    external_provider,
    file_name,
    original_filename: file_name,
    mime_type: null,
    size_bytes: null,
    version,
    is_current: true,
    replaces_file_id,
    is_legal,
    uploaded_by: gate.user!.id,
  });

  if (insErr) {
    return { error: insErr.message };
  }

  await supabase.from("portal_activity").insert({
    client_id: clientId,
    actor_id: gate.user!.id,
    event_type: "file_linked",
    title: `Linked: ${label}`,
    meta: { external_url, external_provider: external_provider ?? "other_https" } as Json,
  });

  revalidatePath("/admin/files");
  revalidatePath("/files");
  return { success: "Google / external link added." };
}

export async function adminUploadVaultFile(
  _prev: VaultUploadState,
  formData: FormData
): Promise<VaultUploadState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) {
    return { error: "Admin access required." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const category = String(formData.get("category") ?? "General").trim() || "General";
  const label = String(formData.get("label") ?? "").trim();
  const replaceId = String(formData.get("replace_file_id") ?? "").trim();
  const file = formData.get("file");

  if (!clientId || !label) {
    return { error: "Client and label are required." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }

  const supabase = await createClient();
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const objectPath = `${clientId}/${crypto.randomUUID()}${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from(VAULT_BUCKET).upload(objectPath, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (upErr) {
    return {
      error: `${upErr.message} If the bucket is missing, run supabase/FEATURES_EXTENSION.sql and confirm Storage has “client-vault”.`,
    };
  }

  const { version, replaces_file_id } = await bumpVaultVersion(supabase, clientId, replaceId || null);

  const folder_key = folderFromCategory(category);
  const is_legal = folder_key === "legal" || /invoice|contract/i.test(category);

  const { error: insErr } = await supabase.from("vault_files").insert({
    client_id: clientId,
    folder_key,
    category,
    label,
    storage_path: objectPath,
    file_name: file.name,
    original_filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    version,
    is_current: true,
    replaces_file_id,
    is_legal,
    uploaded_by: gate.user!.id,
  });

  if (insErr) {
    return { error: insErr.message };
  }

  await supabase.from("portal_activity").insert({
    client_id: clientId,
    actor_id: gate.user!.id,
    event_type: "file_uploaded",
    title: `New file: ${label}`,
    meta: { path: objectPath, category } as Json,
  });

  revalidatePath("/admin/files");
  revalidatePath("/files");
  return { success: "File uploaded." };
}
