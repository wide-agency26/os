"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_REVISION_ROUNDS,
  DEFAULT_TERMS_TEXT,
  DEFAULT_CONSERVATIVE_BODY,
  DEFAULT_CONSERVATIVE_EYEBROW,
  DEFAULT_SOW_THEME,
  DEFAULT_SOW_VAT,
  SOW_CATEGORY_ORDER,
  portrayalForCategory,
  slugifySowPart,
} from "@/lib/sow/constants";
import type { SowCategory, SowLineItemTemplate, PmService, SowTheme, SowVat } from "@/lib/sow/types";
import { loadSowDocument } from "@/lib/sow/load-sow";

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" as string };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isFounder(profile.role)) {
    return { supabase, user: null, error: "Only admins can manage SOWs" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateSowPaths(sowId?: string) {
  revalidatePath("/app/bd/lms");
  revalidatePath("/app/client-sow");
  if (sowId) {
    revalidatePath(`/app/bd/lms/${sowId}`);
    revalidatePath(`/app/client-sow/${sowId}`);
  }
}

async function insertServiceSection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    sowId: string;
    service: PmService;
    templates: SowLineItemTemplate[];
    sortOrder: number;
  }
) {
  const portrayal = portrayalForCategory(opts.service.category);
  const { data: section, error: secErr } = await supabase
    .from("sow_sections")
    .insert({
      sow_id: opts.sowId,
      category: opts.service.category,
      title: opts.service.name,
      portrayal,
      intro: opts.service.short_description,
      service_id: opts.service.id,
      service_name_snapshot: opts.service.name,
      service_description_snapshot: opts.service.description,
      service_short_description_snapshot: opts.service.short_description,
      sort_order: opts.sortOrder,
    })
    .select("*")
    .single();

  if (secErr || !section) throw new Error(secErr?.message ?? "Failed to create section");

  const serviceTemplates = opts.templates
    .filter((t) => t.service_id === opts.service.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (serviceTemplates.length > 0) {
    const { error: itemErr } = await supabase.from("sow_line_items").insert(
      serviceTemplates.map((t, idx) => ({
        sow_id: opts.sowId,
        section_id: section.id,
        service_id: opts.service.id,
        template_id: t.id,
        title: t.title,
        description: t.description,
        is_manual: false,
        price: null,
        requires_quantity: t.requires_quantity,
        quantity_label: null,
        cadence: t.is_recurring ? "monthly" : null,
        is_recurring: t.is_recurring,
        uses_revision_rounds: t.uses_revision_rounds,
        is_gate_note: t.is_gate_note,
        sort_order: idx + 1,
      }))
    );
    if (itemErr) throw new Error(itemErr.message);
  }

  return section;
}

export async function createSow(input: {
  companyId: string;
  title?: string;
  packageId?: string | null;
  serviceIds?: string[];
  bdRecordId?: string | null;
}): Promise<{ ok: boolean; sowId?: string; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const { data: company, error: coErr } = await supabase
    .from("crm_customers")
    .select("id, name, company, status, record_kind")
    .eq("id", input.companyId)
    .maybeSingle();
  if (coErr || !company) return { ok: false, error: coErr?.message ?? "Company not found" };
  if (company.record_kind && company.record_kind !== "company") {
    return { ok: false, error: "SOWs must be assigned to a company record" };
  }

  let serviceIds = input.serviceIds ?? [];
  if (input.packageId) {
    const { data: pkgServices, error: pkgErr } = await supabase
      .from("pm_package_services")
      .select("service_id")
      .eq("package_id", input.packageId);
    if (pkgErr) return { ok: false, error: pkgErr.message };
    serviceIds = (pkgServices ?? []).map((r) => r.service_id);
  }

  const { data: services, error: svcErr } = await supabase
    .from("pm_services")
    .select("id, name, category, sort_order, description, short_description")
    .in("id", serviceIds.length ? serviceIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order");

  if (svcErr) return { ok: false, error: svcErr.message };

  const { data: templates, error: tplErr } = await supabase
    .from("sow_line_item_templates")
    .select("*")
    .order("sort_order");
  if (tplErr) return { ok: false, error: tplErr.message };

  const companyLabel = company.company || company.name || "Company";
  const title = input.title?.trim() || `Scope of Work — ${companyLabel}`;

  const { data: sow, error: sowErr } = await supabase
    .from("sows")
    .insert({
      company_id: input.companyId,
      project_id: null,
      title,
      status: "draft",
      package_id: input.packageId ?? null,
      revision_rounds: DEFAULT_REVISION_ROUNDS,
      terms_text: DEFAULT_TERMS_TEXT,
      intro_narrative:
        "Beyond the slides and the jargon — this is the work that turns your company into a brand people actually fall for. Here's exactly what we deliver, and where the edges are.",
      show_conservative_block: true,
      conservative_eyebrow: DEFAULT_CONSERVATIVE_EYEBROW,
      conservative_body: DEFAULT_CONSERVATIVE_BODY,
      document_date: new Date().toISOString().slice(0, 10),
      theme: DEFAULT_SOW_THEME,
      vat: DEFAULT_SOW_VAT,
      currency: "EUR",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sowErr || !sow) return { ok: false, error: sowErr?.message ?? "Failed to create SOW" };

  try {
    const sorted = [...(services as PmService[])].sort((a, b) => {
      const ai = SOW_CATEGORY_ORDER.indexOf(a.category);
      const bi = SOW_CATEGORY_ORDER.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return a.sort_order - b.sort_order;
    });

    let order = 1;
    for (const service of sorted) {
      await insertServiceSection(supabase, {
        sowId: sow.id,
        service,
        templates: (templates ?? []) as SowLineItemTemplate[],
        sortOrder: order++,
      });
    }
  } catch (e) {
    await supabase.from("sows").delete().eq("id", sow.id);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to seed sections" };
  }

  if (input.bdRecordId) {
    const { linkBdProposal } = await import("@/app/actions/bd");
    await linkBdProposal({
      bdRecordId: input.bdRecordId,
      type: "sow",
      linkedId: sow.id,
      status: "draft",
      title,
    });
  }

  revalidateSowPaths(sow.id);
  return { ok: true, sowId: sow.id };
}

export async function deleteSow(sowId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { error: delErr } = await supabase.from("sows").delete().eq("id", sowId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidateSowPaths(sowId);
  return { ok: true };
}

export async function addServiceToSow(input: {
  sowId: string;
  serviceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { data: sow } = await supabase.from("sows").select("id").eq("id", input.sowId).maybeSingle();
  if (!sow) return { ok: false, error: "SOW not found" };

  const { data: service, error: svcErr } = await supabase
    .from("pm_services")
    .select("id, name, category, sort_order, description, short_description")
    .eq("id", input.serviceId)
    .maybeSingle();
  if (svcErr || !service) return { ok: false, error: svcErr?.message ?? "Service not found" };

  const { data: templates } = await supabase
    .from("sow_line_item_templates")
    .select("*")
    .eq("service_id", input.serviceId)
    .order("sort_order");

  const { data: maxRow } = await supabase
    .from("sow_sections")
    .select("sort_order")
    .eq("sow_id", input.sowId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    await insertServiceSection(supabase, {
      sowId: input.sowId,
      service: service as PmService,
      templates: (templates ?? []) as SowLineItemTemplate[],
      sortOrder: (maxRow?.sort_order ?? 0) + 1,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add service" };
  }

  await supabase
    .from("sows")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.sowId);

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function updateSowMeta(input: {
  sowId: string;
  title?: string;
  intro_narrative?: string | null;
  terms_text?: string;
  revision_rounds?: number;
  currency?: string;
  show_conservative_block?: boolean;
  conservative_eyebrow?: string;
  conservative_body?: string;
  project_id?: string | null;
  document_date?: string;
  theme?: Partial<SowTheme>;
  vat?: Partial<SowVat>;
  public_slug?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const patch: {
    title?: string;
    intro_narrative?: string | null;
    terms_text?: string;
    revision_rounds?: number;
    currency?: string;
    show_conservative_block?: boolean;
    conservative_eyebrow?: string;
    conservative_body?: string;
    project_id?: string | null;
    document_date?: string;
    theme?: SowTheme;
    vat?: SowVat;
    public_slug?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.intro_narrative !== undefined) patch.intro_narrative = input.intro_narrative;
  if (input.terms_text !== undefined) patch.terms_text = input.terms_text;
  if (input.revision_rounds !== undefined) {
    patch.revision_rounds = Math.max(1, Math.min(5, input.revision_rounds));
  }
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.show_conservative_block !== undefined) {
    patch.show_conservative_block = input.show_conservative_block;
  }
  if (input.conservative_eyebrow !== undefined) {
    patch.conservative_eyebrow = input.conservative_eyebrow;
  }
  if (input.conservative_body !== undefined) {
    patch.conservative_body = input.conservative_body;
  }
  if (input.project_id !== undefined) patch.project_id = input.project_id;
  if (input.document_date !== undefined) patch.document_date = input.document_date;
  if (input.theme !== undefined) {
    const { data: current } = await supabase
      .from("sows")
      .select("theme")
      .eq("id", input.sowId)
      .maybeSingle();
    patch.theme = {
      ...DEFAULT_SOW_THEME,
      ...((current?.theme as Partial<SowTheme> | null) || {}),
      ...input.theme,
    };
  }
  if (input.vat !== undefined) {
    const { data: current } = await supabase
      .from("sows")
      .select("vat")
      .eq("id", input.sowId)
      .maybeSingle();
    const merged = {
      ...DEFAULT_SOW_VAT,
      ...((current?.vat as Partial<SowVat> | null) || {}),
      ...input.vat,
    };
    patch.vat = {
      enabled: merged.enabled ?? DEFAULT_SOW_VAT.enabled,
      rate: Math.max(0, Math.min(100, Number(merged.rate) || DEFAULT_SOW_VAT.rate)),
      wording: merged.wording?.trim() || DEFAULT_SOW_VAT.wording,
    };
  }
  if (input.public_slug !== undefined) {
    const cleaned = input.public_slug
      ? slugifySowPart(input.public_slug)
      : null;
    patch.public_slug = cleaned || null;
  }

  const { error: updErr } = await supabase.from("sows").update(patch).eq("id", input.sowId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function setSowStatus(input: {
  sowId: string;
  status: "draft" | "published" | "accepted" | "archived";
}): Promise<{ ok: boolean; error?: string; shareUrl?: string; publicSlug?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  if (input.status === "published") {
    const { data: doc } = await loadSowDocument(input.sowId);
    if (doc) {
      const missingQty = doc.sections
        .flatMap((s) => s.line_items)
        .filter((i) => i.requires_quantity && !i.quantity_label?.trim());
      if (missingQty.length > 0) {
        return {
          ok: false,
          error: `Set quantity/cadence on: ${missingQty.map((i) => i.title).join(", ")}`,
        };
      }
    }
  }

  const { data: existing } = await supabase
    .from("sows")
    .select("public_slug, title, company_id, crm_customers!company_id ( company, name )")
    .eq("id", input.sowId)
    .maybeSingle();

  let publicSlug = existing?.public_slug as string | null | undefined;

  if (input.status === "published" && !publicSlug) {
    const coRaw = existing?.crm_customers as
      | { company?: string; name?: string }
      | { company?: string; name?: string }[]
      | null
      | undefined;
    const co = Array.isArray(coRaw) ? coRaw[0] : coRaw;
    const base =
      slugifySowPart(co?.company || co?.name || existing?.title || "sow") || "sow";
    publicSlug = `${base}-${input.sowId.slice(0, 8)}`;
  }

  const patch: {
    status: "draft" | "published" | "accepted" | "archived";
    updated_at: string;
    published_at?: string | null;
    public_slug?: string | null;
  } = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.status === "published") {
    patch.published_at = new Date().toISOString();
    if (publicSlug) patch.public_slug = publicSlug;
  }
  if (input.status === "draft") patch.published_at = null;

  const { error: updErr } = await supabase.from("sows").update(patch).eq("id", input.sowId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateSowPaths(input.sowId);
  if (input.status === "published" && publicSlug) {
    revalidatePath(`/s/${publicSlug}`);
    return { ok: true, publicSlug, shareUrl: `/s/${publicSlug}` };
  }
  return { ok: true };
}

export async function updateSection(input: {
  sectionId: string;
  title?: string;
  intro?: string | null;
  service_description_snapshot?: string | null;
  sort_order?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const patch: {
    title?: string;
    intro?: string | null;
    service_description_snapshot?: string | null;
    sort_order?: number;
  } = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.intro !== undefined) patch.intro = input.intro;
  if (input.service_description_snapshot !== undefined) {
    patch.service_description_snapshot = input.service_description_snapshot;
  }
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  const { data, error: updErr } = await supabase
    .from("sow_sections")
    .update(patch)
    .eq("id", input.sectionId)
    .select("sow_id")
    .maybeSingle();
  if (updErr) return { ok: false, error: updErr.message };

  if (data?.sow_id) {
    await supabase
      .from("sows")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.sow_id);
    revalidateSowPaths(data.sow_id);
  }
  return { ok: true };
}

export async function deleteSection(sectionId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { data: section } = await supabase
    .from("sow_sections")
    .select("sow_id")
    .eq("id", sectionId)
    .maybeSingle();

  const { error: delErr } = await supabase.from("sow_sections").delete().eq("id", sectionId);
  if (delErr) return { ok: false, error: delErr.message };

  if (section?.sow_id) revalidateSowPaths(section.sow_id);
  return { ok: true };
}

export async function reorderSections(input: {
  sowId: string;
  orderedIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error: updErr } = await supabase
      .from("sow_sections")
      .update({ sort_order: i + 1 })
      .eq("id", input.orderedIds[i])
      .eq("sow_id", input.sowId);
    if (updErr) return { ok: false, error: updErr.message };
  }
  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function upsertLineItem(input: {
  id?: string;
  sowId: string;
  sectionId: string;
  title: string;
  description?: string | null;
  price?: number | null;
  quantity_label?: string | null;
  cadence?: string | null;
  is_recurring?: boolean;
  requires_quantity?: boolean;
  uses_revision_rounds?: boolean;
  is_manual?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  if (input.id) {
    const { error: updErr } = await supabase
      .from("sow_line_items")
      .update({
        title: input.title,
        description: input.description ?? null,
        price: input.price ?? null,
        quantity_label: input.quantity_label ?? null,
        cadence: input.cadence ?? null,
        is_recurring: input.is_recurring ?? false,
        requires_quantity: input.requires_quantity ?? false,
        uses_revision_rounds: input.uses_revision_rounds ?? false,
      })
      .eq("id", input.id);
    if (updErr) return { ok: false, error: updErr.message };
    revalidateSowPaths(input.sowId);
    return { ok: true, id: input.id };
  }

  const { data: maxRow } = await supabase
    .from("sow_line_items")
    .select("sort_order")
    .eq("section_id", input.sectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error: insErr } = await supabase
    .from("sow_line_items")
    .insert({
      sow_id: input.sowId,
      section_id: input.sectionId,
      title: input.title,
      description: input.description ?? null,
      price: input.price ?? null,
      quantity_label: input.quantity_label ?? null,
      cadence: input.cadence ?? null,
      is_recurring: input.is_recurring ?? false,
      requires_quantity: input.requires_quantity ?? false,
      uses_revision_rounds: input.uses_revision_rounds ?? false,
      is_manual: input.is_manual ?? true,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Insert failed" };
  revalidateSowPaths(input.sowId);
  return { ok: true, id: data.id };
}

export async function deleteLineItem(itemId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { data: item } = await supabase
    .from("sow_line_items")
    .select("sow_id, cost_group_id")
    .eq("id", itemId)
    .maybeSingle();

  const { error: delErr } = await supabase.from("sow_line_items").delete().eq("id", itemId);
  if (delErr) return { ok: false, error: delErr.message };

  if (item?.cost_group_id) {
    const { count } = await supabase
      .from("sow_line_items")
      .select("id", { count: "exact", head: true })
      .eq("cost_group_id", item.cost_group_id);
    if ((count ?? 0) === 0) {
      await supabase.from("sow_cost_groups").delete().eq("id", item.cost_group_id);
    }
  }

  if (item?.sow_id) revalidateSowPaths(item.sow_id);
  return { ok: true };
}

export async function reorderLineItems(input: {
  sowId: string;
  sectionId: string;
  orderedIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error: updErr } = await supabase
      .from("sow_line_items")
      .update({ sort_order: i + 1 })
      .eq("id", input.orderedIds[i])
      .eq("section_id", input.sectionId);
    if (updErr) return { ok: false, error: updErr.message };
  }
  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function mergeLineItems(input: {
  sowId: string;
  itemIds: string[];
  groupTitle: string;
  groupPrice: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (input.itemIds.length < 2) return { ok: false, error: "Select at least two line items" };

  const { data: items, error: loadErr } = await supabase
    .from("sow_line_items")
    .select("*")
    .in("id", input.itemIds)
    .eq("sow_id", input.sowId);
  if (loadErr) return { ok: false, error: loadErr.message };
  if (!items || items.length < 2) return { ok: false, error: "Items not found" };

  const { data: maxGroup } = await supabase
    .from("sow_cost_groups")
    .select("sort_order")
    .eq("sow_id", input.sowId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: group, error: gErr } = await supabase
    .from("sow_cost_groups")
    .insert({
      sow_id: input.sowId,
      title: input.groupTitle.trim() || "Grouped scope",
      price: input.groupPrice,
      sort_order: (maxGroup?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (gErr || !group) return { ok: false, error: gErr?.message ?? "Failed to create group" };

  for (const item of items) {
    const original =
      item.original_price != null
        ? item.original_price
        : item.price != null
          ? item.price
          : null;
    const { error: updErr } = await supabase
      .from("sow_line_items")
      .update({
        cost_group_id: group.id,
        original_price: original,
        price: null,
      })
      .eq("id", item.id);
    if (updErr) return { ok: false, error: updErr.message };
  }

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function unmergeCostGroup(input: {
  sowId: string;
  costGroupId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { data: items } = await supabase
    .from("sow_line_items")
    .select("id, original_price")
    .eq("cost_group_id", input.costGroupId);

  for (const item of items ?? []) {
    await supabase
      .from("sow_line_items")
      .update({
        cost_group_id: null,
        price: item.original_price,
        original_price: null,
      })
      .eq("id", item.id);
  }

  const { error: delErr } = await supabase
    .from("sow_cost_groups")
    .delete()
    .eq("id", input.costGroupId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function updateCostGroup(input: {
  sowId: string;
  costGroupId: string;
  title?: string;
  price?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const patch: { title?: string; price?: number } = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.price !== undefined) patch.price = input.price;

  const { error: updErr } = await supabase
    .from("sow_cost_groups")
    .update(patch)
    .eq("id", input.costGroupId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function addPortfolioSlide(input: {
  sowId: string;
  source_url?: string;
  link_url?: string | null;
  title: string;
  image_url?: string | null;
  candidate_images?: string[];
  category_tags?: string[];
  slide_kind?: "scraped" | "screenshot";
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { count } = await supabase
    .from("sow_portfolio_slides")
    .select("id", { count: "exact", head: true })
    .eq("sow_id", input.sowId);
  if ((count ?? 0) >= 6) return { ok: false, error: "Maximum 6 portfolio slides" };

  const { data: maxRow } = await supabase
    .from("sow_portfolio_slides")
    .select("sort_order")
    .eq("sow_id", input.sowId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const source = input.source_url || input.link_url || "";
  const link = input.link_url || input.source_url || null;

  const { data, error: insErr } = await supabase
    .from("sow_portfolio_slides")
    .insert({
      sow_id: input.sowId,
      source_url: source,
      link_url: link,
      title: input.title,
      image_url: input.image_url ?? null,
      candidate_images: input.candidate_images ?? [],
      category_tags: input.category_tags ?? [],
      slide_kind: input.slide_kind ?? "scraped",
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Insert failed" };
  revalidateSowPaths(input.sowId);
  return { ok: true, id: data.id };
}

export async function updatePortfolioSlide(input: {
  sowId: string;
  slideId: string;
  title?: string;
  caption?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  sort_order?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const patch: {
    title?: string;
    caption?: string | null;
    image_url?: string | null;
    link_url?: string | null;
    sort_order?: number;
  } = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.caption !== undefined) patch.caption = input.caption;
  if (input.image_url !== undefined) patch.image_url = input.image_url;
  if (input.link_url !== undefined) patch.link_url = input.link_url;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  const { error: updErr } = await supabase
    .from("sow_portfolio_slides")
    .update(patch)
    .eq("id", input.slideId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function deletePortfolioSlide(
  slideId: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { data: slide } = await supabase
    .from("sow_portfolio_slides")
    .select("sow_id")
    .eq("id", slideId)
    .maybeSingle();

  const { error: delErr } = await supabase
    .from("sow_portfolio_slides")
    .delete()
    .eq("id", slideId);
  if (delErr) return { ok: false, error: delErr.message };

  if (slide?.sow_id) revalidateSowPaths(slide.sow_id);
  return { ok: true };
}

export async function addCustomSection(input: {
  sowId: string;
  title: string;
  category?: SowCategory;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const category = input.category ?? "custom";
  const { data: maxRow } = await supabase
    .from("sow_sections")
    .select("sort_order")
    .eq("sow_id", input.sowId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insErr } = await supabase.from("sow_sections").insert({
    sow_id: input.sowId,
    category,
    title: input.title,
    portrayal: portrayalForCategory(category),
    sort_order: (maxRow?.sort_order ?? 0) + 1,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidateSowPaths(input.sowId);
  return { ok: true };
}
