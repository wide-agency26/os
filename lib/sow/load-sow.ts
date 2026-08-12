import { createClient } from "@/utils/supabase/server";
import type {
  SowDocument,
  SowLineItem,
  SowSection,
  SowStatus,
  SowCategory,
  SowPortrayal,
} from "./types";
import {
  DEFAULT_CONSERVATIVE_BODY,
  DEFAULT_CONSERVATIVE_EYEBROW,
  resolveSowTheme,
  resolveSowVat,
} from "./constants";
import type { SowTheme, SowVat } from "./types";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadSowDocument(
  sowId: string
): Promise<{ data: SowDocument | null; error?: string }> {
  const supabase = await createClient();

  const { data: sow, error } = await supabase
    .from("sows")
    .select(
      `
      *,
      crm_customers!company_id (
        id,
        name,
        company,
        status
      ),
      projects!project_id (
        id,
        title,
        stage,
        client_id
      ),
      pm_packages!package_id (
        id,
        name
      )
    `
    )
    .eq("id", sowId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!sow) return { data: null, error: "SOW not found" };

  const [{ data: sections }, { data: items }, { data: groups }, { data: slides }] =
    await Promise.all([
      supabase
        .from("sow_sections")
        .select("*")
        .eq("sow_id", sowId)
        .order("sort_order"),
      supabase
        .from("sow_line_items")
        .select("*")
        .eq("sow_id", sowId)
        .order("sort_order"),
      supabase
        .from("sow_cost_groups")
        .select("*")
        .eq("sow_id", sowId)
        .order("sort_order"),
      supabase
        .from("sow_portfolio_slides")
        .select("*")
        .eq("sow_id", sowId)
        .order("sort_order"),
    ]);

  const lineItems: SowLineItem[] = (items ?? []).map((row) => ({
    id: row.id,
    sow_id: row.sow_id,
    section_id: row.section_id,
    service_id: row.service_id,
    template_id: row.template_id,
    title: row.title,
    description: row.description,
    is_manual: row.is_manual,
    price: num(row.price),
    original_price: num(row.original_price),
    cost_group_id: row.cost_group_id,
    quantity_label: row.quantity_label,
    requires_quantity: row.requires_quantity,
    cadence: row.cadence,
    is_recurring: row.is_recurring,
    uses_revision_rounds: row.uses_revision_rounds,
    is_gate_note: row.is_gate_note,
    sort_order: row.sort_order,
  }));

  const bySection = new Map<string, SowLineItem[]>();
  for (const item of lineItems) {
    const list = bySection.get(item.section_id) ?? [];
    list.push(item);
    bySection.set(item.section_id, list);
  }

  const mappedSections: SowSection[] = (sections ?? []).map((s) => ({
    id: s.id,
    sow_id: s.sow_id,
    category: s.category as SowCategory,
    title: s.title,
    portrayal: s.portrayal as SowPortrayal,
    intro: s.intro,
    service_id: s.service_id,
    service_name_snapshot: s.service_name_snapshot,
    service_description_snapshot: s.service_description_snapshot,
    service_short_description_snapshot: s.service_short_description_snapshot,
    sort_order: s.sort_order,
    line_items: bySection.get(s.id) ?? [],
  }));

  const companyRaw = sow.crm_customers as
    | {
        id: string;
        name: string | null;
        company: string | null;
        status: string | null;
      }
    | {
        id: string;
        name: string | null;
        company: string | null;
        status: string | null;
      }[]
    | null;
  const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;

  const projRaw = sow.projects as
    | {
        id: string;
        title: string;
        stage: string | null;
        client_id: string | null;
      }
    | {
        id: string;
        title: string;
        stage: string | null;
        client_id: string | null;
      }[]
    | null;
  const project = Array.isArray(projRaw) ? projRaw[0] ?? null : projRaw;

  const pkgRaw = sow.pm_packages as
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;

  const document: SowDocument = {
    id: sow.id,
    company_id: sow.company_id as string,
    project_id: sow.project_id,
    title: sow.title,
    status: sow.status as SowStatus,
    package_id: sow.package_id,
    revision_rounds: sow.revision_rounds,
    terms_text: sow.terms_text,
    intro_narrative: sow.intro_narrative,
    show_conservative_block: sow.show_conservative_block ?? true,
    conservative_eyebrow:
      sow.conservative_eyebrow || DEFAULT_CONSERVATIVE_EYEBROW,
    conservative_body: sow.conservative_body || DEFAULT_CONSERVATIVE_BODY,
    document_date: (sow as { document_date?: string }).document_date
      || new Date().toISOString().slice(0, 10),
    theme: resolveSowTheme(
      ((sow as { theme?: Partial<SowTheme> | null }).theme || null) as
        | Partial<SowTheme>
        | null
    ),
    vat: resolveSowVat(
      ((sow as { vat?: Partial<SowVat> | null }).vat || null) as
        | Partial<SowVat>
        | null
    ),
    public_slug: (sow as { public_slug?: string | null }).public_slug ?? null,
    currency: sow.currency,
    published_at: sow.published_at,
    created_by: sow.created_by,
    created_at: sow.created_at,
    updated_at: sow.updated_at,
    sections: mappedSections,
    cost_groups: (groups ?? []).map((g) => ({
      id: g.id,
      sow_id: g.sow_id,
      title: g.title,
      price: num(g.price) ?? 0,
      sort_order: g.sort_order,
    })),
    portfolio_slides: (slides ?? []).map((s) => ({
      id: s.id,
      sow_id: s.sow_id,
      source_url: s.source_url || "",
      link_url: s.link_url,
      title: s.title,
      caption: (s as { caption?: string | null }).caption ?? null,
      image_url: s.image_url,
      candidate_images: Array.isArray(s.candidate_images)
        ? (s.candidate_images as string[])
        : [],
      category_tags: s.category_tags ?? [],
      slide_kind: (s.slide_kind as "scraped" | "screenshot") || "scraped",
      sort_order: s.sort_order,
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
    package: Array.isArray(pkgRaw) ? pkgRaw[0] ?? null : pkgRaw,
  };

  return { data: document };
}
