"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { revalidateWork } from "@/lib/work/revalidate";
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
import type { SowCategory, SowLineItemTemplate, PmService, SowPortfolioSlide, SowTheme, SowVat } from "@/lib/sow/types";
import { sanitizePortfolioTitle, normalizePortfolioUrl } from "@/lib/sow/portfolio";
import { loadSowDocument, loadSowVersionFamily } from "@/lib/sow/load-sow";
import { createSowCore, insertServiceSection } from "@/lib/sow/create-sow-core";
import { assertSowWritable } from "@/lib/sow/frozen";
import { titleWithSowVersion } from "@/lib/sow/version";
import type { Json } from "@/types/supabase";

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

async function guardWritable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sowId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return assertSowWritable(supabase, sowId);
}

async function nextSowVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ofSowId: string
): Promise<
  | { ok: true; rootId: string; versionNumber: number; companyId: string; title: string }
  | { ok: false; error: string }
> {
  const { data: source } = await supabase
    .from("sows")
    .select("id, title, company_id, version_root_id, version_number")
    .eq("id", ofSowId)
    .maybeSingle();
  if (!source) return { ok: false, error: "SOW not found" };
  const row = source as {
    id: string;
    title: string;
    company_id: string;
    version_root_id?: string | null;
    version_number?: number | null;
  };
  const rootId = row.version_root_id || row.id;
  const { data: family } = await supabase
    .from("sows")
    .select("id, version_number")
    .or(`id.eq.${rootId},version_root_id.eq.${rootId}`);
  const max = Math.max(
    1,
    row.version_number ?? 1,
    ...(family ?? []).map((s) => (s as { version_number?: number }).version_number ?? 1)
  );
  return {
    ok: true,
    rootId,
    versionNumber: max + 1,
    companyId: row.company_id,
    title: row.title,
  };
}

function revalidateSowPaths(sowId?: string) {
  revalidateWork({ sowId });
  revalidatePath("/app/client-sow");
  if (sowId) {
    revalidatePath(`/app/client-sow/${sowId}`);
  }
}

async function touchSowFinance(sowId: string) {
  try {
    const { applySowDealValue } = await import("@/lib/accounting/deal-value");
    await applySowDealValue(sowId);
  } catch {
    /* finance sync is best-effort */
  }
}

export async function getSowBuilderData(sowId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { data, error: loadErr } = await loadSowDocument(sowId);
  if (loadErr || !data) return { ok: false as const, error: loadErr || "Not found" };
  const versions = await loadSowVersionFamily(sowId);
  const { data: packages } = await supabase
    .from("pm_packages")
    .select("id, name")
    .order("sort_order");
  return {
    ok: true as const,
    sow: data,
    versions,
    packages: ((packages ?? []) as { id: string; name: string }[]).map((p) => ({
      id: p.id,
      name: p.name,
    })),
  };
}

export async function createSow(input: {
  companyId: string;
  title?: string;
  packageId?: string | null;
  serviceIds?: string[];
  bdRecordId?: string | null;
  contextText?: string | null;
  versionOfId?: string | null;
  projectId?: string | null;
  contactIds?: string[];
  separateDeal?: boolean;
}): Promise<{ ok: boolean; sowId?: string; projectId?: string; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const result = await createSowCore(supabase, {
    ...input,
    createdBy: user.id,
    ownerId: user.id,
  });
  if (!result.ok) return result;

  if (result.projectId) {
    revalidatePath(`/app/projects/${result.projectId}`);
    revalidatePath(`/app/projects/${result.projectId}/sow`);
  }

  revalidateSowPaths(result.sowId);
  return { ok: true, sowId: result.sowId, projectId: result.projectId };
}

export async function deleteSow(sowId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, sowId);
  if (!gate.ok) return gate;

  const { count: laterCount } = await supabase
    .from("sows")
    .select("id", { count: "exact", head: true })
    .eq("version_root_id", sowId);
  if ((laterCount ?? 0) > 0) {
    return {
      ok: false,
      error: "This SOW has later versions. Delete or unlink those first.",
    };
  }

  const { error: delErr } = await supabase.from("sows").delete().eq("id", sowId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidateSowPaths(sowId);
  return { ok: true };
}

/** Clone an existing SOW into a new unpublished draft (same company, no share slug). */
export async function duplicateSow(
  sowId: string,
  opts?: { asVersion?: boolean }
): Promise<{ ok: boolean; sowId?: string; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const { data: source, error: loadErr } = await loadSowDocument(sowId);
  if (loadErr || !source) {
    return { ok: false, error: loadErr || "SOW not found" };
  }

  let title = `Copy of ${source.title.replace(/^(Copy of )+/i, "").trim() || "Scope of Work"}`;
  let versionRootId: string | null = null;
  let versionNumber = 1;
  if (opts?.asVersion) {
    const next = await nextSowVersion(supabase, sowId);
    if (!next.ok) return next;
    versionRootId = next.rootId;
    versionNumber = next.versionNumber;
    title = titleWithSowVersion(source.title, versionNumber);
  }

  const { data: sow, error: sowErr } = await supabase
    .from("sows")
    .insert({
      company_id: source.company_id,
      project_id: opts?.asVersion ? source.project_id : null,
      title,
      status: "draft",
      package_id: source.package_id,
      revision_rounds: source.revision_rounds,
      terms_text: source.terms_text,
      intro_narrative: source.intro_narrative,
      show_conservative_block: source.show_conservative_block,
      conservative_eyebrow: source.conservative_eyebrow,
      conservative_body: source.conservative_body,
      document_date: new Date().toISOString().slice(0, 10),
      theme: source.theme,
      vat: source.vat,
      currency: source.currency,
      public_slug: null,
      published_at: null,
      created_by: user.id,
      version_root_id: versionRootId,
      version_number: versionNumber,
    } as never)
    .select("id")
    .single();

  if (sowErr || !sow) {
    return { ok: false, error: sowErr?.message ?? "Failed to duplicate SOW" };
  }

  try {
    const groupIdMap = new Map<string, string>();
    if (source.cost_groups.length > 0) {
      const groupRows = source.cost_groups.map((g) => {
        const id = crypto.randomUUID();
        groupIdMap.set(g.id, id);
        return {
          id,
          sow_id: sow.id,
          title: g.title,
          price: g.price,
          sort_order: g.sort_order,
        };
      });
      const { error: gErr } = await supabase.from("sow_cost_groups").insert(groupRows);
      if (gErr) throw new Error(gErr.message);
    }

    const itemIdMap = new Map<string, string>();
    for (const s of source.sections) {
      for (const item of s.line_items) {
        itemIdMap.set(item.id, crypto.randomUUID());
      }
    }

    const sectionIdMap = new Map<string, string>();
    if (source.sections.length > 0) {
      const sectionRows = source.sections.map((s) => {
        const id = crypto.randomUUID();
        sectionIdMap.set(s.id, id);
        const origin = s.merge_origin?.map((o) => ({
          ...o,
          item_ids: o.item_ids
            .map((itemId) => itemIdMap.get(itemId))
            .filter((mapped): mapped is string => Boolean(mapped)),
        }));
        return {
          id,
          sow_id: sow.id,
          category: s.category,
          title: s.title,
          portrayal: s.portrayal,
          intro: s.intro,
          service_id: s.service_id,
          service_name_snapshot: s.service_name_snapshot,
          service_description_snapshot: s.service_description_snapshot,
          service_short_description_snapshot: s.service_short_description_snapshot,
          sort_order: s.sort_order,
          merge_origin: origin ?? null,
        } as never;
      });
      const { error: sErr } = await supabase.from("sow_sections").insert(sectionRows);
      if (sErr) throw new Error(sErr.message);
    }

    const lineRows = source.sections.flatMap((s) =>
      s.line_items.map((item) => {
        const sectionId = sectionIdMap.get(s.id);
        const lineId = itemIdMap.get(item.id);
        if (!sectionId || !lineId) {
          throw new Error("Failed to remap SOW section");
        }
        return {
          id: lineId,
          sow_id: sow.id,
          section_id: sectionId,
          service_id: item.service_id,
          template_id: item.template_id,
          title: item.title,
          description: item.description,
          is_manual: item.is_manual,
          price: item.price,
          original_price: item.original_price,
          cost_group_id: item.cost_group_id
            ? groupIdMap.get(item.cost_group_id) ?? null
            : null,
          quantity_label: item.quantity_label,
          requires_quantity: item.requires_quantity,
          cadence: item.cadence,
          is_recurring: item.is_recurring,
          uses_revision_rounds: item.uses_revision_rounds,
          is_gate_note: item.is_gate_note,
          sort_order: item.sort_order,
        };
      })
    );
    if (lineRows.length > 0) {
      const { error: iErr } = await supabase.from("sow_line_items").insert(lineRows);
      if (iErr) throw new Error(iErr.message);
    }

    if (source.portfolio_slides.length > 0) {
      const { error: pErr } = await supabase.from("sow_portfolio_slides").insert(
        source.portfolio_slides.map((slide) => ({
          sow_id: sow.id,
          source_url: slide.source_url,
          link_url: slide.link_url,
          title: slide.title,
          caption: slide.caption,
          image_url: slide.image_url,
          candidate_images: slide.candidate_images,
          category_tags: slide.category_tags,
          slide_kind: slide.slide_kind,
          sort_order: slide.sort_order,
        }))
      );
      if (pErr) throw new Error(pErr.message);
    }
  } catch (e) {
    await supabase.from("sows").delete().eq("id", sow.id);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to copy SOW contents",
    };
  }

  if (source.company_id) {
    const { ensureSowLeadProject } = await import("@/lib/projects/commercial");
    const companyName =
      source.company?.company || source.company?.name || "Company";
    const linked = await ensureSowLeadProject(supabase, {
      sowId: sow.id,
      companyId: source.company_id,
      companyName,
      title,
      ownerId: user.id,
      versionOfId: opts?.asVersion ? sowId : null,
      projectId: opts?.asVersion ? source.project_id : null,
      separateDeal: !opts?.asVersion,
    });
    if (linked.projectId) {
      const { applyProjectDealValue } = await import(
        "@/lib/accounting/deal-value"
      );
      await applyProjectDealValue(linked.projectId);
    }
  }

  revalidateSowPaths(sow.id);
  await touchSowFinance(sow.id);
  return { ok: true, sowId: sow.id };
}

/** Attach an existing SOW as the next version of another (writes only the child row). */
export async function linkSowAsVersion(input: {
  sowId: string;
  ofSowId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (input.sowId === input.ofSowId) {
    return { ok: false, error: "Pick a different SOW to version against" };
  }

  const { data: child } = await supabase
    .from("sows")
    .select("id, company_id")
    .eq("id", input.sowId)
    .maybeSingle();
  if (!child) return { ok: false, error: "SOW not found" };

  const { count: dependents } = await supabase
    .from("sows")
    .select("id", { count: "exact", head: true })
    .eq("version_root_id", input.sowId);
  if ((dependents ?? 0) > 0) {
    return {
      ok: false,
      error: "This SOW already has later versions. Link those instead.",
    };
  }

  const next = await nextSowVersion(supabase, input.ofSowId);
  if (!next.ok) return next;
  if (next.companyId !== child.company_id) {
    return { ok: false, error: "Versions must belong to the same company" };
  }
  if (next.rootId === input.sowId) {
    return { ok: false, error: "This SOW is already the original in that family" };
  }

  const { error: updErr } = await supabase
    .from("sows")
    .update({
      version_root_id: next.rootId,
      version_number: next.versionNumber,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.sowId);
  if (updErr) return { ok: false, error: updErr.message };

  const { data: parent } = await supabase
    .from("sows")
    .select("project_id")
    .eq("id", input.ofSowId)
    .maybeSingle();
  if (parent?.project_id) {
    await supabase
      .from("sows")
      .update({ project_id: parent.project_id })
      .eq("id", input.sowId);
  }

  revalidateSowPaths(input.sowId);
  await touchSowFinance(input.sowId);
  return { ok: true };
}

export async function unlinkSowVersion(
  sowId: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, sowId);
  if (!gate.ok) return gate;

  const { count: dependents } = await supabase
    .from("sows")
    .select("id", { count: "exact", head: true })
    .eq("version_root_id", sowId);
  if ((dependents ?? 0) > 0) {
    return {
      ok: false,
      error: "Unlink later versions first.",
    };
  }

  const { error: updErr } = await supabase
    .from("sows")
    .update({
      version_root_id: null,
      version_number: 1,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", sowId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidateSowPaths(sowId);
  return { ok: true };
}

export async function addServiceToSow(input: {
  sowId: string;
  serviceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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

export async function addPackageToSow(input: {
  sowId: string;
  packageId: string;
}): Promise<{ ok: boolean; error?: string; added?: number }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const { data: sow } = await supabase
    .from("sows")
    .select("id, package_id")
    .eq("id", input.sowId)
    .maybeSingle();
  if (!sow) return { ok: false, error: "SOW not found" };

  const { data: pkg, error: pkgErr } = await supabase
    .from("pm_packages")
    .select("id, name")
    .eq("id", input.packageId)
    .maybeSingle();
  if (pkgErr || !pkg) return { ok: false, error: pkgErr?.message ?? "Package not found" };

  const { data: pkgServices, error: linkErr } = await supabase
    .from("pm_package_services")
    .select("service_id")
    .eq("package_id", input.packageId);
  if (linkErr) return { ok: false, error: linkErr.message };

  const serviceIds = (pkgServices ?? []).map((r) => r.service_id as string).filter(Boolean);
  if (!serviceIds.length) {
    return { ok: false, error: "This package has no services linked yet" };
  }

  const { data: existingSections } = await supabase
    .from("sow_sections")
    .select("service_id")
    .eq("sow_id", input.sowId);
  const already = new Set(
    ((existingSections ?? []) as { service_id: string | null }[])
      .map((s) => s.service_id)
      .filter(Boolean) as string[]
  );
  const toAdd = serviceIds.filter((id) => !already.has(id));

  const { data: services, error: svcErr } = await supabase
    .from("pm_services")
    .select("id, name, category, sort_order, description, short_description")
    .in("id", toAdd.length ? toAdd : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order");
  if (svcErr) return { ok: false, error: svcErr.message };

  const { data: templates } = await supabase
    .from("sow_line_item_templates")
    .select("*")
    .in("service_id", toAdd.length ? toAdd : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order");

  const { data: maxRow } = await supabase
    .from("sow_sections")
    .select("sort_order")
    .eq("sow_id", input.sowId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sortOrder = (maxRow?.sort_order ?? 0) + 1;
  let added = 0;
  try {
    for (const service of (services ?? []) as PmService[]) {
      await insertServiceSection(supabase, {
        sowId: input.sowId,
        service,
        templates: (templates ?? []) as SowLineItemTemplate[],
        sortOrder,
      });
      sortOrder += 1;
      added += 1;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add package" };
  }

  await supabase
    .from("sows")
    .update({
      package_id: input.packageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sowId);

  revalidateSowPaths(input.sowId);
  return { ok: true, added };
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
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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
  if (input.title !== undefined) patch.title = input.title.trim();
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

  const { data: before } = await supabase
    .from("sows")
    .select("title, public_slug, project_id")
    .eq("id", input.sowId)
    .maybeSingle();

  const { error: updErr } = await supabase.from("sows").update(patch).eq("id", input.sowId);
  if (updErr) return { ok: false, error: updErr.message };

  if (input.title !== undefined && input.title.trim()) {
    const nextTitle = input.title.trim();
    const { data: recs } = await supabase
      .from("bd_records")
      .select("id, proposal")
      .filter("proposal->>linked_id", "eq", input.sowId);
    for (const rec of recs ?? []) {
      const current =
        rec.proposal && typeof rec.proposal === "object"
          ? (rec.proposal as Record<string, unknown>)
          : {};
      if (current.type && current.type !== "sow") continue;
      await supabase
        .from("bd_records")
        .update({
          proposal: {
            ...current,
            title: nextTitle,
            updated_at: new Date().toISOString(),
          } as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rec.id);
      revalidateWork({ bdId: rec.id });
    }
    if (before?.project_id && before.title && before.title !== nextTitle) {
      await supabase
        .from("projects")
        .update({ title: nextTitle, updated_at: new Date().toISOString() })
        .eq("id", before.project_id)
        .eq("title", before.title);
    }
    const slug = before?.public_slug;
    if (slug) revalidatePath(`/s/${slug}`);
  }

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function setSowStatus(input: {
  sowId: string;
  status: "draft" | "published" | "accepted" | "archived";
}): Promise<{ ok: boolean; error?: string; shareUrl?: string; publicSlug?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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

  await touchSowFinance(input.sowId);
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

  const { data: existing } = await supabase
    .from("sow_sections")
    .select("sow_id")
    .eq("id", input.sectionId)
    .maybeSingle();
  if (!existing?.sow_id) return { ok: false, error: "Section not found" };
  const gate = await guardWritable(supabase, existing.sow_id);
  if (!gate.ok) return gate;

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
  if (section?.sow_id) {
    const gate = await guardWritable(supabase, section.sow_id);
    if (!gate.ok) return gate;
  }

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
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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
    await touchSowFinance(input.sowId);
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
  await touchSowFinance(input.sowId);
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
  if (item?.sow_id) {
    const gate = await guardWritable(supabase, item.sow_id);
    if (!gate.ok) return gate;
  }

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

  if (item?.sow_id) {
    revalidateSowPaths(item.sow_id);
    await touchSowFinance(item.sow_id);
  }
  return { ok: true };
}

export async function reorderLineItems(input: {
  sowId: string;
  sectionId: string;
  orderedIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;
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
  await touchSowFinance(input.sowId);
  return { ok: true };
}

export async function unmergeCostGroup(input: {
  sowId: string;
  costGroupId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const patch: { title?: string; price?: number } = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.price !== undefined) patch.price = input.price;

  const { error: updErr } = await supabase
    .from("sow_cost_groups")
    .update(patch)
    .eq("id", input.costGroupId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateSowPaths(input.sowId);
  await touchSowFinance(input.sowId);
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
  caption?: string | null;
}): Promise<{ ok: boolean; id?: string; slide?: SowPortfolioSlide; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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
  const link = input.link_url
    ? normalizePortfolioUrl(input.link_url)
    : input.source_url
      ? normalizePortfolioUrl(input.source_url)
      : null;

  const { data, error: insErr } = await supabase
    .from("sow_portfolio_slides")
    .insert({
      sow_id: input.sowId,
      source_url: source,
      link_url: link,
      title: sanitizePortfolioTitle(input.title),
      caption: input.caption ?? null,
      image_url: input.image_url ?? null,
      candidate_images: input.candidate_images ?? [],
      category_tags: input.category_tags ?? [],
      slide_kind: input.slide_kind ?? "scraped",
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select(
      "id, sow_id, source_url, link_url, title, caption, image_url, candidate_images, category_tags, slide_kind, sort_order"
    )
    .single();

  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Insert failed" };
  revalidateSowPaths(input.sowId);
  const slide: SowPortfolioSlide = {
    id: data.id,
    sow_id: data.sow_id,
    source_url: data.source_url || "",
    link_url: data.link_url,
    title: data.title,
    caption: data.caption ?? null,
    image_url: data.image_url,
    candidate_images: Array.isArray(data.candidate_images)
      ? data.candidate_images.filter((v): v is string => typeof v === "string")
      : [],
    category_tags: Array.isArray(data.category_tags)
      ? data.category_tags.filter((v): v is string => typeof v === "string")
      : [],
    slide_kind: (data.slide_kind as SowPortfolioSlide["slide_kind"]) || "scraped",
    sort_order: data.sort_order,
  };
  return { ok: true, id: data.id, slide };
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
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const patch: {
    title?: string;
    caption?: string | null;
    image_url?: string | null;
    link_url?: string | null;
    sort_order?: number;
  } = {};
  if (input.title !== undefined) patch.title = sanitizePortfolioTitle(input.title);
  if (input.caption !== undefined) patch.caption = input.caption;
  if (input.image_url !== undefined) patch.image_url = input.image_url;
  if (input.link_url !== undefined) {
    patch.link_url =
      input.link_url && input.link_url.trim()
        ? normalizePortfolioUrl(input.link_url)
        : "";
  }
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  const { error: updErr } = await supabase
    .from("sow_portfolio_slides")
    .update(patch)
    .eq("id", input.slideId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateSowPaths(input.sowId);
  return { ok: true };
}

export async function featurePortfolioSlide(input: {
  sowId: string;
  slideId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const { data: slides, error: loadErr } = await supabase
    .from("sow_portfolio_slides")
    .select("id")
    .eq("sow_id", input.sowId)
    .order("sort_order");
  if (loadErr) return { ok: false, error: loadErr.message };

  const ids = (slides ?? []).map((s) => s.id);
  if (!ids.includes(input.slideId)) return { ok: false, error: "Slide not found" };

  const rest = ids.filter((id) => id !== input.slideId);
  const ordered = [input.slideId, ...rest];
  const results = await Promise.all(
    ordered.map((id, i) =>
      supabase.from("sow_portfolio_slides").update({ sort_order: i + 1 }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

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
  if (slide?.sow_id) {
    const gate = await guardWritable(supabase, slide.sow_id);
    if (!gate.ok) return gate;
  }

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
  const gate = await guardWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

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
