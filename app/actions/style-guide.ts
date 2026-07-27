"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "client-vault";

export type StyleGuideState = { error?: string; success?: string };

export async function upsertStyleGuideItem(
  _prev: StyleGuideState,
  formData: FormData
): Promise<StyleGuideState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Admin only." };

  const id = String(formData.get("id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const component_kind = String(formData.get("component_kind") ?? "component").trim();
  const staging_url = String(formData.get("staging_url") ?? "").trim() || null;
  const why_notes = String(formData.get("why_notes") ?? "").trim() || null;
  const dos = String(formData.get("dos") ?? "").trim() || null;
  const donts = String(formData.get("donts") ?? "").trim() || null;
  const sort_order = Number(formData.get("sort_order") ?? "0") || 0;
  const file = formData.get("screenshot");

  if (!clientId || !title) {
    return { error: "Client and title are required." };
  }

  const supabase = await createClient();
  let screenshot_storage_path: string | null = null;

  if (file instanceof File && file.size > 0) {
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const objectPath = `style-guide/${clientId}/${crypto.randomUUID()}${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) return { error: upErr.message };
    screenshot_storage_path = objectPath;
  }

  if (id) {
    const patch: Record<string, unknown> = {
      title,
      component_kind,
      staging_url,
      why_notes,
      dos,
      donts,
      sort_order,
      updated_at: new Date().toISOString(),
    };
    if (screenshot_storage_path) patch.screenshot_storage_path = screenshot_storage_path;
    const { error } = await supabase.from("web_style_guide_items").update(patch as any).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("web_style_guide_items").insert({
      client_id: clientId,
      title,
      component_kind,
      staging_url,
      why_notes,
      dos,
      donts,
      sort_order,
      screenshot_storage_path,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/style-guide");
  revalidatePath("/style-guide");
  return { success: "Saved." };
}

export async function deleteStyleGuideItem(id: string) {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Admin only." };
  const supabase = await createClient();
  const { error } = await supabase.from("web_style_guide_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/style-guide");
  revalidatePath("/style-guide");
  return { success: true as const };
}
