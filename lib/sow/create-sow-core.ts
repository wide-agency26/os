import {
  DEFAULT_REVISION_ROUNDS,
  DEFAULT_TERMS_TEXT,
  DEFAULT_CONSERVATIVE_BODY,
  DEFAULT_CONSERVATIVE_EYEBROW,
  DEFAULT_SOW_THEME,
  DEFAULT_SOW_VAT,
  SOW_CATEGORY_ORDER,
  portrayalForCategory,
} from "@/lib/sow/constants";
import type { PmService, SowLineItemTemplate } from "@/lib/sow/types";
import { titleWithSowVersion } from "@/lib/sow/version";
import { attachSowToProject, ensureSowLeadProject } from "@/lib/projects/commercial";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SowDb = { from: (table: string) => any };

export type CreateSowCoreInput = {
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
  createdBy?: string | null;
  ownerId?: string | null;
};

export type CreateSowCoreSow = {
  id: string;
  title: string;
  status: string;
  company_id: string;
  project_id: string | null;
  version_number: number;
  currency: string;
  document_date: string;
};

export type CreateSowCoreResult =
  | { ok: true; sowId: string; projectId?: string; sow: CreateSowCoreSow }
  | { ok: false; error: string };

async function nextSowVersion(
  supabase: SowDb,
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
    ...(family ?? []).map((s: { version_number?: number }) => s.version_number ?? 1)
  );
  return {
    ok: true,
    rootId,
    versionNumber: max + 1,
    companyId: row.company_id,
    title: row.title,
  };
}

export async function insertServiceSection(
  supabase: SowDb,
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

export async function createSowCore(
  supabase: SowDb,
  input: CreateSowCoreInput
): Promise<CreateSowCoreResult> {
  const { data: company, error: coErr } = await supabase
    .from("crm_customers")
    .select("id, name, company, status, record_kind")
    .eq("id", input.companyId)
    .maybeSingle();
  if (coErr || !company) {
    return { ok: false, error: coErr?.message ?? "Company not found" };
  }
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
    serviceIds = (pkgServices ?? []).map((r: { service_id: string }) => r.service_id);
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
  let title = input.title?.trim() || `Scope of Work — ${companyLabel}`;
  let versionRootId: string | null = null;
  let versionNumber = 1;
  if (input.versionOfId) {
    const next = await nextSowVersion(supabase, input.versionOfId);
    if (!next.ok) return next;
    if (next.companyId !== input.companyId) {
      return { ok: false, error: "A later version must belong to the same company" };
    }
    versionRootId = next.rootId;
    versionNumber = next.versionNumber;
    if (!input.title?.trim()) {
      title = titleWithSowVersion(next.title, versionNumber);
    }
  }

  let projectId = input.projectId || null;
  if (!projectId && input.versionOfId) {
    const { data: sourceSow } = await supabase
      .from("sows")
      .select("project_id")
      .eq("id", input.versionOfId)
      .maybeSingle();
    projectId = sourceSow?.project_id ?? null;
  }

  const documentDate = new Date().toISOString().slice(0, 10);

  const { data: sow, error: sowErr } = await supabase
    .from("sows")
    .insert({
      company_id: input.companyId,
      project_id: projectId,
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
      document_date: documentDate,
      theme: DEFAULT_SOW_THEME,
      vat: DEFAULT_SOW_VAT,
      currency: "EUR",
      created_by: input.createdBy ?? null,
      version_root_id: versionRootId,
      version_number: versionNumber,
      assist_context: input.contextText?.trim()
        ? {
            raw_text: input.contextText.trim(),
            notes: [input.contextText.trim()],
            bd_record_id: input.bdRecordId || null,
            answers: {},
            pending_suggestions: [],
            updated_at: new Date().toISOString(),
          }
        : {},
    } as never)
    .select(
      "id, title, status, company_id, project_id, version_number, currency, document_date"
    )
    .single();

  if (sowErr || !sow) {
    return { ok: false, error: sowErr?.message ?? "Failed to create SOW" };
  }

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
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to seed sections",
    };
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

  if (input.ownerId) {
    const linked = await ensureSowLeadProject(supabase, {
      sowId: sow.id,
      companyId: input.companyId,
      companyName: companyLabel,
      title,
      ownerId: input.ownerId,
      versionOfId: input.versionOfId,
      projectId,
      separateDeal: input.separateDeal,
      contactIds: input.contactIds,
      bdRecordId: input.bdRecordId,
    });
    projectId = linked.projectId;
  } else if (projectId) {
    await attachSowToProject(supabase, sow.id, projectId);
  } else {
    return {
      ok: false,
      error: "No founder profile available to create or link a lead project.",
    };
  }

  if (projectId) {
    try {
      const { applyProjectDealValue } = await import("@/lib/accounting/deal-value");
      await applyProjectDealValue(projectId);
    } catch {
      /* finance sync is best-effort */
    }
  }

  const sowRow = sow as CreateSowCoreSow;
  return {
    ok: true,
    sowId: sowRow.id,
    projectId: projectId ?? undefined,
    sow: {
      ...sowRow,
      project_id: projectId,
    },
  };
}
