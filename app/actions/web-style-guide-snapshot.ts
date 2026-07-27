"use server";

import { PDFParse } from "pdf-parse";
import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { looksLikeHtmlMarkup } from "@/lib/web-style-guide/process-html";
import { buildStyleGuideDocumentFromHtml } from "@/lib/web-style-guide/html-to-document";
import { buildStyleGuideDocumentFromAi, WSG_AI_SYSTEM } from "@/lib/web-style-guide/ai-to-document";
import { generateJsonFromGateway, hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { createClient } from "@/utils/supabase/server";

const MAX_INLINE_STYLES = 400_000;
const MAX_PDF_NOTES = 50_000;

export type WebStyleGuideSnapshotState = { error?: string; success?: string };

async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

async function fetchExistingSnapshot(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  const { data } = await supabase
    .from("web_style_guide_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  return data as
    | {
        pdf_notes: string | null;
      }
    | null;
}

export async function importWebStyleGuideSnapshot(
  _prev: WebStyleGuideSnapshotState,
  formData: FormData
): Promise<WebStyleGuideSnapshotState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Admin only." };

  const clientId = String(formData.get("client_id") ?? "").trim();
  const baseUrl = String(formData.get("base_url") ?? "").trim() || null;
  const file = formData.get("source");

  if (!clientId) return { error: "Client is required." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an HTML or PDF file." };

  const supabase = await createClient();
  const existing = await fetchExistingSnapshot(supabase, clientId);

  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");

  if (isPdf) {
    const buf = Buffer.from(await file.arrayBuffer());
    let notes = await pdfBufferToText(buf);
    if (!notes) notes = "(No extractable text was found in this PDF.)";
    notes = notes.slice(0, MAX_PDF_NOTES);

    const { data: row } = await supabase
      .from("web_style_guide_snapshots")
      .select("client_id")
      .eq("client_id", clientId)
      .maybeSingle();

    const patch = {
      pdf_notes: notes,
      source_filename: file.name,
      updated_at: new Date().toISOString(),
    };

    const { error } = row
      ? await supabase.from("web_style_guide_snapshots").update(patch).eq("client_id", clientId)
      : await supabase.from("web_style_guide_snapshots").insert({ client_id: clientId, ...patch });

    if (error) return { error: error.message };

    revalidatePath("/admin/style-guide");
    revalidatePath("/style-guide");
    return {
      success:
        "PDF text saved as supplementary notes. Export HTML from Webflow for the full Flowkit layout in the portal.",
    };
  }

  const raw = await file.text();
  if (!looksLikeHtmlMarkup(raw)) {
    return {
      error:
        "That file does not look like HTML. Upload a Webflow / exported .html page (or paste-export), or use PDF for text notes only.",
    };
  }

  let doc;
  try {
    doc = buildStyleGuideDocumentFromHtml(raw, baseUrl);
  } catch {
    return { error: "Could not parse this HTML. Try a full page export including <head> stylesheets." };
  }

  const inlineHeadStyles = doc.inlineHeadStyles.slice(0, MAX_INLINE_STYLES);

  const { error } = await supabase.from("web_style_guide_snapshots").upsert(
    {
      client_id: clientId,
      body_class: doc.meta.bodyClass,
      html_fragment: "",
      stylesheet_hrefs: doc.stylesheetHrefs,
      inline_head_styles: inlineHeadStyles,
      style_guide_document: doc as unknown as Record<string, unknown>,
      pdf_notes: existing?.pdf_notes ?? null,
      source_filename: file.name,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "client_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/style-guide");
  revalidatePath("/style-guide");
  const blockCount = doc.sections.length;
  return {
    success:
      blockCount > 0
        ? `Imported ${blockCount} editable section${blockCount === 1 ? "" : "s"}. Clients see this playbook now; use the block editor to refine and save changes.`
        : "HTML imported; no sections were detected — try an export with section[id] blocks or add sections manually.",
  };
}

const MAX_AI_SOURCE_CHARS = 16_000;

async function fileToSourceText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  if (isPdf) {
    const buf = Buffer.from(await file.arrayBuffer());
    return (await pdfBufferToText(buf)) || "";
  }
  const textLike =
    file.type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".html") ||
    name.endsWith(".htm");
  if (textLike) {
    return (await file.text()).trim();
  }
  return "";
}

/** AI path: turn ANY document (PDF/text/notes) into an editable web style guide. */
export async function generateWebStyleGuideFromDocument(
  _prev: WebStyleGuideSnapshotState,
  formData: FormData
): Promise<WebStyleGuideSnapshotState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Admin only." };

  const clientId = String(formData.get("client_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("source");

  if (!clientId) return { error: "Client is required." };
  if (!hasGatewayCredentials()) {
    return {
      error: "AI generation is off — set AI_GATEWAY_API_KEY (automatic on Vercel) to enable this.",
    };
  }

  let sourceText = "";
  let sourceName: string | null = null;
  if (file instanceof File && file.size > 0) {
    sourceName = file.name;
    sourceText = await fileToSourceText(file);
  }

  if (!sourceText && !notes) {
    return { error: "Upload a document or add some notes describing the brand for the AI to use." };
  }

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

  const prompt = `Brand / product: ${titleFallback}
${sourceName ? `Source file: ${sourceName}\n` : ""}
--- Source document ---
${(sourceText || "(no text extracted)").slice(0, MAX_AI_SOURCE_CHARS)}
--- End ---
${notes ? `\n--- Additional notes ---\n${notes.slice(0, 4000)}` : ""}`;

  let parsed: unknown;
  try {
    parsed = await generateJsonFromGateway({
      system: WSG_AI_SYSTEM,
      prompt,
      maxOutputTokens: 8000,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI generation failed.";
    return { error: msg };
  }

  if (!parsed || typeof parsed !== "object") {
    return { error: "AI returned no usable data. Try again or add more detail in notes." };
  }

  const doc = buildStyleGuideDocumentFromAi(parsed, titleFallback);
  if (doc.sections.length === 0) {
    return { error: "AI produced no sections. Try a richer source document or notes." };
  }

  const { data: existing } = await supabase
    .from("web_style_guide_snapshots")
    .select("pdf_notes")
    .eq("client_id", clientId)
    .maybeSingle();

  const { error } = await supabase.from("web_style_guide_snapshots").upsert(
    {
      client_id: clientId,
      body_class: "",
      html_fragment: "",
      stylesheet_hrefs: [],
      inline_head_styles: "",
      style_guide_document: doc as unknown as Record<string, unknown>,
      pdf_notes: (existing as { pdf_notes?: string | null } | null)?.pdf_notes ?? null,
      source_filename: sourceName,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "client_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/style-guide");
  revalidatePath("/style-guide");
  revalidatePath(`/cm/${clientId}/webstyleguide`);
  revalidatePath(`/admin/cm/${clientId}/webstyleguide`);
  revalidatePath(`/client/${clientId}/webstyleguide`);

  const n = doc.sections.length;
  return {
    success: `AI generated ${n} editable section${n === 1 ? "" : "s"}. Review and refine the blocks below, then save.`,
  };
}

export async function clearWebStyleGuideHtmlSnapshot(clientId: string): Promise<WebStyleGuideSnapshotState> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { error: "Admin only." };
  if (!clientId) return { error: "Missing client." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("web_style_guide_snapshots")
    .select("pdf_notes")
    .eq("client_id", clientId)
    .maybeSingle();

  const { error } = await supabase.from("web_style_guide_snapshots").upsert(
    {
      client_id: clientId,
      body_class: "",
      html_fragment: "",
      stylesheet_hrefs: [],
      inline_head_styles: "",
      style_guide_document: null,
      pdf_notes: (existing as { pdf_notes?: string | null } | null)?.pdf_notes ?? null,
      source_filename: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/style-guide");
  revalidatePath("/style-guide");
  return { success: "Playbook HTML cleared." };
}

export async function clearWebStyleGuideHtmlSnapshotForm(
  _prev: WebStyleGuideSnapshotState,
  formData: FormData
): Promise<WebStyleGuideSnapshotState> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  return clearWebStyleGuideHtmlSnapshot(clientId);
}
