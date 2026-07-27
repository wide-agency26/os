"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { isWebStyleGuideDocument, mergeStyleGuideDocument } from "@/lib/web-style-guide/document";
import { createClient } from "@/utils/supabase/server";

export async function saveWebStyleGuideDocument(
  clientId: string,
  doc: unknown
): Promise<{ error?: string; success?: string }> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Agency access required." };
  if (!clientId?.trim()) return { error: "Missing client." };
  if (!isWebStyleGuideDocument(doc)) return { error: "Invalid playbook document." };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", clientId)
    .maybeSingle();

  const titleFallback =
    (profile as { company_name?: string | null; full_name?: string | null } | null)?.company_name?.trim() ||
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    "Style Guide";

  const merged = mergeStyleGuideDocument(doc, titleFallback);

  const { data: existing } = await supabase
    .from("web_style_guide_snapshots")
    .select("pdf_notes, source_filename")
    .eq("client_id", clientId)
    .maybeSingle();

  const ex = existing as { pdf_notes?: string | null; source_filename?: string | null } | null;

  const { error } = await supabase.from("web_style_guide_snapshots").upsert(
    {
      client_id: clientId,
      body_class: merged.meta.bodyClass,
      html_fragment: "",
      stylesheet_hrefs: merged.stylesheetHrefs,
      inline_head_styles: merged.inlineHeadStyles,
      style_guide_document: merged as unknown as Record<string, unknown>,
      pdf_notes: ex?.pdf_notes ?? null,
      source_filename: ex?.source_filename ?? null,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "client_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/style-guide");
  revalidatePath(`/cm/${clientId}/webstyleguide`);
  revalidatePath(`/admin/cm/${clientId}/webstyleguide`);
  revalidatePath(`/client/${clientId}/webstyleguide`);
  return { success: "Playbook blocks saved. Clients see the updated preview." };
}
