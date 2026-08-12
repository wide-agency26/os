import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/utils/supabase/env";
import type {
  SowCategory,
  SowDocument,
  SowLineItem,
  SowPortrayal,
  SowSection,
  SowStatus,
  SowTheme,
  SowVat,
} from "./types";
import {
  DEFAULT_CONSERVATIVE_BODY,
  DEFAULT_CONSERVATIVE_EYEBROW,
  resolveSowTheme,
  resolveSowVat,
} from "./constants";

export type PublicSowPayload =
  | { state: "not_found" }
  | { state: "draft"; title: string }
  | { state: "success"; sow: SowDocument };

function createFallbackClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey());
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Load a published SOW by public slug for unauthenticated share links.
 * Uses service role on the server only — no anon table grants required.
 */
export async function loadPublishedSowBySlug(
  slug: string
): Promise<PublicSowPayload> {
  let supabase: ReturnType<typeof createAdminClient> | ReturnType<typeof createFallbackClient>;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = createFallbackClient();
  }

  const { data: row, error } = await supabase
    .from("sows")
    .select("id, title, status")
    .eq("public_slug", slug)
    .maybeSingle();

  if (error || !row) return { state: "not_found" };
  if (row.status !== "published") {
    return { state: "draft", title: row.title };
  }

  const { data: full } = await mapSowDocument(supabase, row.id);
  if (!full) return { state: "not_found" };
  return { state: "success", sow: full };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mapSowDocument(supabase: any, sowId: string) {
  const { data: sow, error } = await supabase
    .from("sows")
    .select(
      `
      *,
      crm_customers!company_id ( id, name, company, status ),
      projects!project_id ( id, title, stage, client_id ),
      pm_packages!package_id ( id, name )
    `
    )
    .eq("id", sowId)
    .maybeSingle();

  if (error || !sow) return { data: null };

  const [{ data: sections }, { data: items }, { data: groups }, { data: slides }] =
    await Promise.all([
      supabase.from("sow_sections").select("*").eq("sow_id", sowId).order("sort_order"),
      supabase.from("sow_line_items").select("*").eq("sow_id", sowId).order("sort_order"),
      supabase.from("sow_cost_groups").select("*").eq("sow_id", sowId).order("sort_order"),
      supabase.from("sow_portfolio_slides").select("*").eq("sow_id", sowId).order("sort_order"),
    ]);

  const lineItems: SowLineItem[] = (items ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    sow_id: row.sow_id as string,
    section_id: row.section_id as string,
    service_id: (row.service_id as string | null) ?? null,
    template_id: (row.template_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    is_manual: Boolean(row.is_manual),
    price: num(row.price),
    original_price: num(row.original_price),
    cost_group_id: (row.cost_group_id as string | null) ?? null,
    quantity_label: (row.quantity_label as string | null) ?? null,
    requires_quantity: Boolean(row.requires_quantity),
    cadence: (row.cadence as string | null) ?? null,
    is_recurring: Boolean(row.is_recurring),
    uses_revision_rounds: Boolean(row.uses_revision_rounds),
    is_gate_note: Boolean(row.is_gate_note),
    sort_order: row.sort_order as number,
  }));

  const bySection = new Map<string, SowLineItem[]>();
  for (const item of lineItems) {
    const list = bySection.get(item.section_id) ?? [];
    list.push(item);
    bySection.set(item.section_id, list);
  }

  const mappedSections: SowSection[] = (sections ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    sow_id: s.sow_id as string,
    category: s.category as SowCategory,
    title: s.title as string,
    portrayal: s.portrayal as SowPortrayal,
    intro: (s.intro as string | null) ?? null,
    service_id: (s.service_id as string | null) ?? null,
    service_name_snapshot: (s.service_name_snapshot as string | null) ?? null,
    service_description_snapshot:
      (s.service_description_snapshot as string | null) ?? null,
    service_short_description_snapshot:
      (s.service_short_description_snapshot as string | null) ?? null,
    sort_order: s.sort_order as number,
    line_items: bySection.get(s.id as string) ?? [],
  }));

  const companyRaw = sow.crm_customers;
  const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
  const projRaw = sow.projects;
  const project = Array.isArray(projRaw) ? projRaw[0] ?? null : projRaw;
  const pkgRaw = sow.pm_packages;
  const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] ?? null : pkgRaw;

  const document: SowDocument = {
    id: sow.id,
    company_id: sow.company_id,
    project_id: sow.project_id,
    title: sow.title,
    status: sow.status as SowStatus,
    package_id: sow.package_id,
    revision_rounds: sow.revision_rounds,
    terms_text: sow.terms_text,
    intro_narrative: sow.intro_narrative,
    show_conservative_block: sow.show_conservative_block ?? true,
    conservative_eyebrow: sow.conservative_eyebrow || DEFAULT_CONSERVATIVE_EYEBROW,
    conservative_body: sow.conservative_body || DEFAULT_CONSERVATIVE_BODY,
    document_date: sow.document_date || new Date().toISOString().slice(0, 10),
    theme: resolveSowTheme(sow.theme as Partial<SowTheme> | null),
    vat: resolveSowVat(sow.vat as Partial<SowVat> | null),
    public_slug: sow.public_slug ?? null,
    currency: sow.currency,
    published_at: sow.published_at,
    created_by: sow.created_by,
    created_at: sow.created_at,
    updated_at: sow.updated_at,
    sections: mappedSections,
    cost_groups: (groups ?? []).map((g: Record<string, unknown>) => ({
      id: g.id as string,
      sow_id: g.sow_id as string,
      title: g.title as string,
      price: num(g.price) ?? 0,
      sort_order: g.sort_order as number,
    })),
    portfolio_slides: (slides ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      sow_id: s.sow_id as string,
      source_url: (s.source_url as string) || "",
      link_url: (s.link_url as string | null) ?? null,
      title: s.title as string,
      caption: (s.caption as string | null) ?? null,
      image_url: (s.image_url as string | null) ?? null,
      candidate_images: Array.isArray(s.candidate_images)
        ? (s.candidate_images as string[])
        : [],
      category_tags: (s.category_tags as string[]) ?? [],
      slide_kind: ((s.slide_kind as string) || "scraped") as "scraped" | "screenshot",
      sort_order: s.sort_order as number,
    })),
    company: company
      ? {
          id: company.id,
          name: company.name,
          company: company.company,
          status: company.status,
        }
      : undefined,
    project: project ?? null,
    package: pkg,
  };

  return { data: document };
}
