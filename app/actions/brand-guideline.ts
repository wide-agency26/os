"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { buildGuidelineFromUpload } from "@/lib/brand-guideline/extract";
import { mergeWithDefaults } from "@/lib/brand-guideline/defaults";
import { isBrandGuidelineDocument, type BrandGuidelineDocument } from "@/lib/brand-guideline/types";
import { BRAND_GUIDELINES_BUCKET, sanitizeStorageFileName } from "@/lib/brand-guideline/storage";
import { isAgencyStaff } from "@/lib/rbac";
import { clientPortalPath } from "@/lib/routing";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as { role: string } | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
}

function publicUrlForPath(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  const { data } = supabase.storage.from(BRAND_GUIDELINES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function persistSourcePath(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string, path: string) {
  const { data: hub } = await supabase
    .from("brand_hubs")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (hub?.id) {
    await supabase.from("brand_hubs").update({ guideline_source_path: path }).eq("id", hub.id);
  } else {
    await supabase.from("brand_hubs").insert({
      client_id: clientId,
      guideline_source_path: path,
    });
  }
}

export async function saveBrandGuideline(clientId: string, document: unknown) {
  const { supabase, user, profile } = await requireAdmin();
  if (!user || !isAgencyStaff(profile?.role)) {
    return { error: "Unauthorized" };
  }

  const doc: BrandGuidelineDocument = isBrandGuidelineDocument(document)
    ? document
    : mergeWithDefaults(document, "Brand");

  const { data: hub } = await supabase
    .from("brand_hubs")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (hub?.id) {
    const { error } = await supabase
      .from("brand_hubs")
      .update({
        guideline_document: doc as unknown as Record<string, unknown>,
        brand_colors: doc.colors.neons.slice(0, 8).map((c) => ({ name: c.name, hex: c.hex })),
        typography: { primary: doc.typography.fontFamily.split(",")[0]?.trim() ?? "Inter" },
      })
      .eq("id", hub.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("brand_hubs").insert({
      client_id: clientId,
      guideline_document: doc as unknown as Record<string, unknown>,
      brand_colors: doc.colors.neons.slice(0, 8).map((c) => ({ name: c.name, hex: c.hex })),
      typography: { primary: doc.typography.fontFamily.split(",")[0]?.trim() ?? "Inter" },
    });

    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/cm/${clientId}/brandguideline`);
  revalidatePath(`/cm/${clientId}/brandguideline`);
  revalidatePath("/admin/cm/roster");
  revalidatePath(clientPortalPath(clientId, "strategy"));
  return { success: true };
}

export async function extractBrandGuideline(formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  if (!user || !isAgencyStaff(profile?.role)) {
    return { error: "Unauthorized" };
  }

  const clientId = formData.get("client_id") as string;
  const pastedText = (formData.get("pasted_text") as string) ?? "";
  const file = formData.get("file");

  if (!clientId) return { error: "Missing client" };

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", clientId)
    .eq("role", "client")
    .single();

  if (!clientProfile) return { error: "Client not found" };

  const brandName =
    (formData.get("brand_name") as string)?.trim() ||
    clientProfile.full_name ||
    clientProfile.company_name ||
    "Brand";

  const upload = file instanceof File && file.size > 0 ? file : null;

  let sourcePublicUrl: string | null = null;

  if (upload) {
    const safeName = sanitizeStorageFileName(upload.name);
    const path = `${clientId}/sources/${crypto.randomUUID()}_${safeName}`;
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(BRAND_GUIDELINES_BUCKET).upload(path, bytes, {
      contentType: upload.type || "application/octet-stream",
      upsert: false,
    });

    if (!upErr) {
      await persistSourcePath(supabase, clientId, path);
      sourcePublicUrl = publicUrlForPath(supabase, path);
    }
  }

  const result = await buildGuidelineFromUpload({
    file: upload,
    pastedText,
    brandName,
    companyName: clientProfile.company_name,
  });

  revalidatePath(`/admin/cm/${clientId}/brandguideline`);
  revalidatePath(`/cm/${clientId}/brandguideline`);

  return {
    document: result.document,
    usedAi: result.usedAi,
    message: result.message,
    sourcePublicUrl: sourcePublicUrl ?? null,
  };
}

export async function uploadBrandGuidelineBackgroundImage(clientId: string, formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  if (!user || !isAgencyStaff(profile?.role)) {
    return { error: "Unauthorized" };
  }

  const slotIndexRaw = formData.get("slot_index");
  const slotIndex =
    typeof slotIndexRaw === "string" ? parseInt(slotIndexRaw, 10) : Number(slotIndexRaw);
  const file = formData.get("file");

  if (!clientId || !Number.isFinite(slotIndex) || slotIndex < 0) {
    return { error: "Invalid request" };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file" };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Images only (PNG, JPG, WebP, …)" };
  }

  const safeName = sanitizeStorageFileName(file.name);
  const path = `${clientId}/slots/${crypto.randomUUID()}_${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BRAND_GUIDELINES_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (upErr) return { error: upErr.message };

  const publicUrl = publicUrlForPath(supabase, path);
  revalidatePath(`/admin/cm/${clientId}/brandguideline`);
  revalidatePath(`/cm/${clientId}/brandguideline`);
  revalidatePath(clientPortalPath(clientId, "strategy"));

  return { publicUrl, slotIndex };
}
