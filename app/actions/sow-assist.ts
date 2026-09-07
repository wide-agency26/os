"use server";

import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { loadSowDocument } from "@/lib/sow/load-sow";
import { assertSowWritable, isFrozenSowSlug } from "@/lib/sow/frozen";
import { revalidateWork } from "@/lib/work/revalidate";
import {
  emptySowAssistContext,
  mergeSowAssistContext,
  type SowAssistAnswers,
  type SowAssistContext,
  type SowSectionMergeOrigin,
  type SowSuggestion,
} from "@/lib/sow/assist";
import { generateSowSuggestions, rewriteFieldWithContext } from "@/lib/sow/propose";
import { DEFAULT_CONSERVATIVE_BODY, DEFAULT_TERMS_TEXT } from "@/lib/sow/constants";
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

function revalidateSow(sowId: string) {
  revalidateWork({ sowId });
  void import("@/lib/accounting/deal-value").then(({ applySowDealValue }) =>
    applySowDealValue(sowId).catch(() => undefined)
  );
}

async function loadAssist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sowId: string
): Promise<SowAssistContext> {
  const { data } = await supabase
    .from("sows")
    .select("*")
    .eq("id", sowId)
    .maybeSingle();
  return mergeSowAssistContext(
    (data as { assist_context?: unknown } | null)?.assist_context
  );
}

async function persistAssist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sowId: string,
  ctx: SowAssistContext
) {
  await supabase
    .from("sows")
    .update({
      assist_context: ctx as unknown as Json,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", sowId);
}

export async function saveSowAssistContext(input: {
  sowId: string;
  rawText?: string;
  appendNote?: string;
  bdRecordId?: string | null;
  answers?: SowAssistAnswers;
}): Promise<{ ok: boolean; error?: string; context?: SowAssistContext }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await assertSowWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const ctx = await loadAssist(supabase, input.sowId);
  if (input.rawText !== undefined) ctx.raw_text = input.rawText;
  if (input.appendNote?.trim()) {
    ctx.notes.push(input.appendNote.trim());
    ctx.raw_text = [ctx.raw_text, input.appendNote.trim()].filter(Boolean).join("\n\n---\n\n");
  }
  if (input.bdRecordId !== undefined) ctx.bd_record_id = input.bdRecordId;
  if (input.answers) ctx.answers = { ...ctx.answers, ...input.answers };
  ctx.updated_at = new Date().toISOString();
  await persistAssist(supabase, input.sowId, ctx);
  revalidateSow(input.sowId);
  return { ok: true, context: ctx };
}

export async function proposeSowFromContext(input: {
  sowId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  suggestions?: SowSuggestion[];
  usedAi?: boolean;
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await assertSowWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const { data: sow, error: loadErr } = await loadSowDocument(input.sowId);
  if (loadErr || !sow) return { ok: false, error: loadErr || "SOW not found" };

  const ctx = sow.assist_context || emptySowAssistContext();
  let discovery: {
    summary?: string | null;
    needs?: string | null;
    budget?: string | null;
    timeline?: string | null;
    notes_text?: string | null;
    transcript?: string | null;
  } | null = null;
  if (ctx.bd_record_id) {
    const { data: rec } = await supabase
      .from("bd_records")
      .select("discovery_call")
      .eq("id", ctx.bd_record_id)
      .maybeSingle();
    const d = (rec?.discovery_call || {}) as Record<string, unknown>;
    discovery = {
      summary: typeof d.summary === "string" ? d.summary : null,
      needs: typeof d.needs === "string" ? d.needs : null,
      budget: typeof d.budget === "string" ? d.budget : null,
      timeline: typeof d.timeline === "string" ? d.timeline : null,
      notes_text: typeof d.notes_text === "string" ? d.notes_text : null,
      transcript: typeof d.transcript === "string" ? d.transcript : null,
    };
  }

  const { suggestions, usedAi } = await generateSowSuggestions({
    sow,
    rawText: ctx.raw_text,
    answers: ctx.answers,
    discovery,
  });
  ctx.pending_suggestions = suggestions;
  ctx.updated_at = new Date().toISOString();
  await persistAssist(supabase, input.sowId, ctx);
  revalidateSow(input.sowId);
  return { ok: true, suggestions, usedAi };
}

export async function applySowSuggestions(input: {
  sowId: string;
  fields: string[];
  overrides?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string; context?: SowAssistContext }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await assertSowWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const { data: sow, error: loadErr } = await loadSowDocument(input.sowId);
  if (loadErr || !sow) return { ok: false, error: loadErr || "SOW not found" };
  const ctx = sow.assist_context || emptySowAssistContext();
  const wanted = new Set(input.fields);
  const remaining: SowSuggestion[] = [];

  for (const sug of ctx.pending_suggestions) {
    if (!wanted.has(sug.field)) {
      remaining.push(sug);
      continue;
    }
    const text = (input.overrides?.[sug.field] ?? sug.proposed).trim();
    const applied = await applyOneSuggestion(supabase, input.sowId, sug.field, text, sug.price);
    if (!applied.ok) return applied;
  }

  ctx.pending_suggestions = remaining;
  ctx.updated_at = new Date().toISOString();
  await persistAssist(supabase, input.sowId, ctx);
  revalidateSow(input.sowId);
  return { ok: true, context: ctx };
}

export async function skipSowSuggestions(input: {
  sowId: string;
  fields: string[];
}): Promise<{ ok: boolean; error?: string; context?: SowAssistContext }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await assertSowWritable(supabase, input.sowId);
  if (!gate.ok) return gate;
  const ctx = await loadAssist(supabase, input.sowId);
  const skip = new Set(input.fields);
  ctx.pending_suggestions = ctx.pending_suggestions.filter((s) => !skip.has(s.field));
  ctx.updated_at = new Date().toISOString();
  await persistAssist(supabase, input.sowId, ctx);
  revalidateSow(input.sowId);
  return { ok: true, context: ctx };
}

async function applyOneSuggestion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sowId: string,
  field: string,
  text: string,
  price?: number | null
): Promise<{ ok: boolean; error?: string }> {
  if (field === "intro_narrative") {
    const { error } = await supabase
      .from("sows")
      .update({ intro_narrative: text, updated_at: new Date().toISOString() })
      .eq("id", sowId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  if (field === "conservative_body") {
    const { error } = await supabase
      .from("sows")
      .update({ conservative_body: text, updated_at: new Date().toISOString() })
      .eq("id", sowId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  if (field === "terms_text") {
    const { error } = await supabase
      .from("sows")
      .update({ terms_text: text, updated_at: new Date().toISOString() })
      .eq("id", sowId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const sectionTitle = field.match(/^section:(.+):title$/);
  if (sectionTitle) {
    const { error } = await supabase
      .from("sow_sections")
      .update({ title: text })
      .eq("id", sectionTitle[1])
      .eq("sow_id", sowId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const sectionDesc = field.match(/^section:(.+):description$/);
  if (sectionDesc) {
    const { error } = await supabase
      .from("sow_sections")
      .update({
        service_description_snapshot: text,
        intro: null,
      })
      .eq("id", sectionDesc[1])
      .eq("sow_id", sowId);
    if (error) return { ok: false, error: error.message };
    if (typeof price === "number") {
      await ensureSectionPrice(supabase, sowId, sectionDesc[1], price);
    }
    return { ok: true };
  }
  const itemTitle = field.match(/^item:(.+):title$/);
  if (itemTitle) {
    const { error } = await supabase
      .from("sow_line_items")
      .update({ title: text })
      .eq("id", itemTitle[1])
      .eq("sow_id", sowId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const itemDesc = field.match(/^item:(.+):description$/);
  if (itemDesc) {
    const { error } = await supabase
      .from("sow_line_items")
      .update({ description: text })
      .eq("id", itemDesc[1])
      .eq("sow_id", sowId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  return { ok: true };
}

async function ensureSectionPrice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sowId: string,
  sectionId: string,
  price: number
) {
  const { data: items } = await supabase
    .from("sow_line_items")
    .select("id, cost_group_id, price, original_price")
    .eq("section_id", sectionId)
    .eq("sow_id", sowId);
  if (!items || items.length === 0) return;
  const groupIds = [
    ...new Set(items.map((i) => i.cost_group_id).filter(Boolean)),
  ] as string[];
  if (groupIds.length === 1) {
    await supabase
      .from("sow_cost_groups")
      .update({ price })
      .eq("id", groupIds[0]);
    return;
  }
  const { data: maxGroup } = await supabase
    .from("sow_cost_groups")
    .select("sort_order")
    .eq("sow_id", sowId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: group } = await supabase
    .from("sow_cost_groups")
    .insert({
      sow_id: sowId,
      title: "Scope",
      price,
      sort_order: (maxGroup?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (!group) return;
  for (const item of items) {
    await supabase
      .from("sow_line_items")
      .update({
        cost_group_id: group.id,
        original_price: item.original_price ?? item.price,
        price: null,
      })
      .eq("id", item.id);
  }
}

export async function rewriteSowField(input: {
  sowId: string;
  field: string;
  current: string;
  mode: "rewrite" | "shorter" | "template";
}): Promise<{ ok: boolean; error?: string; text?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await assertSowWritable(supabase, input.sowId);
  if (!gate.ok) return gate;
  const ctx = await loadAssist(supabase, input.sowId);
  const template =
    input.field === "terms_text"
      ? DEFAULT_TERMS_TEXT
      : input.field === "conservative_body"
        ? DEFAULT_CONSERVATIVE_BODY
        : null;
  try {
    const text = await rewriteFieldWithContext({
      field: input.field,
      current: input.current,
      mode: input.mode,
      rawText: ctx.raw_text,
      answers: ctx.answers,
      template,
    });
    if (!text) return { ok: false, error: "Could not rewrite this field" };
    const next = ctx.pending_suggestions.filter((s) => s.field !== input.field);
    next.push({ id: input.field, field: input.field, proposed: text });
    ctx.pending_suggestions = next;
    ctx.updated_at = new Date().toISOString();
    await persistAssist(supabase, input.sowId, ctx);
    revalidateSow(input.sowId);
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Rewrite failed" };
  }
}

export async function mergeSowSections(input: {
  sowId: string;
  sectionIds: string[];
  title?: string;
  groupPrice: number;
}): Promise<{ ok: boolean; error?: string; sectionId?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await assertSowWritable(supabase, input.sowId);
  if (!gate.ok) return gate;
  if (input.sectionIds.length < 2) {
    return { ok: false, error: "Select at least two scopes" };
  }

  const { data: sections } = await supabase
    .from("sow_sections")
    .select("*")
    .eq("sow_id", input.sowId)
    .in("id", input.sectionIds)
    .order("sort_order");
  if (!sections || sections.length < 2) {
    return { ok: false, error: "Scopes not found" };
  }

  const survivor = sections[0];
  const { data: items } = await supabase
    .from("sow_line_items")
    .select("*")
    .eq("sow_id", input.sowId)
    .in(
      "section_id",
      sections.map((s) => s.id)
    );

  const origin: SowSectionMergeOrigin[] = sections.map((s) => ({
    title: s.title,
    category: s.category,
    portrayal: s.portrayal,
    intro: s.intro,
    service_id: s.service_id,
    service_name_snapshot: s.service_name_snapshot,
    service_description_snapshot: s.service_description_snapshot,
    service_short_description_snapshot: s.service_short_description_snapshot,
    sort_order: s.sort_order,
    item_ids: (items ?? [])
      .filter((i) => i.section_id === s.id)
      .map((i) => i.id),
  }));

  const title =
    input.title?.trim() || sections.map((s) => s.title).join(" + ");

  const { error: updSec } = await supabase
    .from("sow_sections")
    .update({
      title,
      merge_origin: origin as unknown as Json,
      service_description_snapshot:
        sections
          .map((s) => s.service_description_snapshot || s.intro)
          .filter(Boolean)
          .join("\n\n") || survivor.service_description_snapshot,
    } as never)
    .eq("id", survivor.id);
  if (updSec) return { ok: false, error: updSec.message };

  const otherIds = sections.slice(1).map((s) => s.id);
  if (otherIds.length > 0) {
    const { error: moveErr } = await supabase
      .from("sow_line_items")
      .update({ section_id: survivor.id })
      .in("section_id", otherIds)
      .eq("sow_id", input.sowId);
    if (moveErr) return { ok: false, error: moveErr.message };
    const { error: delErr } = await supabase
      .from("sow_sections")
      .delete()
      .in("id", otherIds);
    if (delErr) return { ok: false, error: delErr.message };
  }

  const allItems = items ?? [];
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
      title,
      price: input.groupPrice,
      sort_order: (maxGroup?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (gErr || !group) return { ok: false, error: gErr?.message ?? "Failed to price scope" };

  const staleGroupIds = [
    ...new Set(
      allItems
        .map((i) => i.cost_group_id)
        .filter((id): id is string => Boolean(id) && id !== group.id)
    ),
  ];

  for (const item of allItems) {
    await supabase
      .from("sow_line_items")
      .update({
        section_id: survivor.id,
        cost_group_id: group.id,
        original_price: item.original_price ?? item.price,
        price: null,
      })
      .eq("id", item.id);
  }

  if (staleGroupIds.length > 0) {
    await supabase.from("sow_cost_groups").delete().in("id", staleGroupIds);
  }

  revalidateSow(input.sowId);
  return { ok: true, sectionId: survivor.id };
}

export async function unmergeSowSection(input: {
  sowId: string;
  sectionId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const gate = await assertSowWritable(supabase, input.sowId);
  if (!gate.ok) return gate;

  const { data: section } = await supabase
    .from("sow_sections")
    .select("*")
    .eq("id", input.sectionId)
    .eq("sow_id", input.sowId)
    .maybeSingle();
  if (!section) return { ok: false, error: "Scope not found" };
  const originRaw = (section as unknown as { merge_origin?: unknown }).merge_origin;
  const origin = Array.isArray(originRaw)
    ? (originRaw as SowSectionMergeOrigin[])
    : [];
  if (origin.length < 2) {
    return { ok: false, error: "This scope is not a merged package" };
  }

  const { data: items } = await supabase
    .from("sow_line_items")
    .select("id, cost_group_id, original_price")
    .eq("section_id", input.sectionId);

  const groupIds = [
    ...new Set((items ?? []).map((i) => i.cost_group_id).filter(Boolean)),
  ] as string[];

  const first = origin[0];
  await supabase
    .from("sow_sections")
    .update({
      title: first.title,
      category: first.category,
      portrayal: first.portrayal,
      intro: first.intro,
      service_id: first.service_id,
      service_name_snapshot: first.service_name_snapshot,
      service_description_snapshot: first.service_description_snapshot,
      service_short_description_snapshot: first.service_short_description_snapshot,
      sort_order: first.sort_order,
      merge_origin: null,
    } as never)
    .eq("id", input.sectionId);

  const idMap = new Map<string, string>();
  idMap.set("0", input.sectionId);

  for (let i = 1; i < origin.length; i++) {
    const src = origin[i];
    const { data: created, error: insErr } = await supabase
      .from("sow_sections")
      .insert({
        sow_id: input.sowId,
        title: src.title,
        category: src.category,
        portrayal: src.portrayal,
        intro: src.intro,
        service_id: src.service_id,
        service_name_snapshot: src.service_name_snapshot,
        service_description_snapshot: src.service_description_snapshot,
        service_short_description_snapshot: src.service_short_description_snapshot,
        sort_order: src.sort_order,
      })
      .select("id")
      .single();
    if (insErr || !created) {
      return { ok: false, error: insErr?.message ?? "Failed to restore scope" };
    }
    for (const itemId of src.item_ids) {
      await supabase
        .from("sow_line_items")
        .update({ section_id: created.id })
        .eq("id", itemId)
        .eq("sow_id", input.sowId);
    }
  }

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
  for (const gid of groupIds) {
    await supabase.from("sow_cost_groups").delete().eq("id", gid);
  }

  revalidateSow(input.sowId);
  return { ok: true };
}

export async function listReusablePortfolioSlides(): Promise<{
  ok: boolean;
  error?: string;
  slides: {
    id: string;
    sowId: string;
    sowTitle: string;
    title: string;
    caption: string | null;
    image_url: string | null;
    link_url: string | null;
    source_url: string | null;
  }[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error, slides: [] };

  const { data: sows } = await supabase
    .from("sows")
    .select("id, title, public_slug, status")
    .in("status", ["published", "accepted"])
    .order("updated_at", { ascending: false })
    .limit(40);

  const allowed = (sows ?? []).filter((s) => !isFrozenSowSlug(s.public_slug));
  if (allowed.length === 0) return { ok: true, slides: [] };

  const { data: slides, error: sErr } = await supabase
    .from("sow_portfolio_slides")
    .select("id, sow_id, title, caption, image_url, link_url, source_url")
    .in(
      "sow_id",
      allowed.map((s) => s.id)
    )
    .order("sort_order");
  if (sErr) return { ok: false, error: sErr.message, slides: [] };

  const bySow = new Map(allowed.map((s) => [s.id, s.title]));
  return {
    ok: true,
    slides: (slides ?? [])
      .filter((s) => s.image_url)
      .map((s) => ({
        id: s.id,
        sowId: s.sow_id,
        sowTitle: bySow.get(s.sow_id) || "SOW",
        title: s.title,
        caption: (s as { caption?: string | null }).caption ?? null,
        image_url: s.image_url,
        link_url: s.link_url,
        source_url: s.source_url,
      })),
  };
}

export async function listBdRecordsForSow(): Promise<{
  ok: boolean;
  records: { id: string; label: string }[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, records: [] };
  const { data } = await supabase
    .from("bd_records")
    .select("id, name, company_name")
    .order("updated_at", { ascending: false })
    .limit(80);
  return {
    ok: true,
    records: (data ?? []).map((r) => ({
      id: r.id,
      label: `${r.company_name} · ${r.name}`,
    })),
  };
}

export async function reusePortfolioSlide(input: {
  sowId: string;
  title: string;
  image_url: string;
  caption?: string | null;
  link_url?: string | null;
  source_url?: string | null;
}): Promise<{
  ok: boolean;
  id?: string;
  slide?: import("@/lib/sow/types").SowPortfolioSlide;
  error?: string;
}> {
  const { addPortfolioSlide } = await import("@/app/actions/sow");
  return addPortfolioSlide({
    sowId: input.sowId,
    title: input.title,
    image_url: input.image_url,
    caption: input.caption,
    link_url: input.link_url,
    source_url: input.source_url || input.link_url || "",
    slide_kind: "scraped",
  });
}
