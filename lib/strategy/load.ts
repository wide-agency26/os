/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AUDIENCE_MODULE_KEY,
  COMPETITION_MODULE_KEY,
  MARKET_MODULE_KEY,
  MODULE_BLURBS,
  MODULE_LABELS,
  SENTIMENT_MODULE_KEY,
  SYNTHESIS_MODULE_KEY,
  STRATEGY_TYPE_LABELS,
  isModuleKey,
  isStrategyType,
  type ModuleKey,
  type ModuleStatus,
  type ScopeStatus,
  type StrategyModuleCard,
  type StrategyStatus,
  type StrategyType,
} from "@/lib/strategy/modules";
import type { AudienceSnapshot } from "@/lib/audience/types";
import type { MarketSnapshot } from "@/lib/market/types";
import type { SentimentSnapshot } from "@/lib/sentiment/strategy";
import type { PositioningSnapshot } from "@/lib/positioning/types";
import type { CompetitionSnapshot } from "@/lib/competition/types";
import type {
  CatalogPackageRow,
  CatalogServiceRow,
  ProposeProjectOption,
  ScopeRow,
  StrategyRow,
} from "@/lib/strategy/types";

type Sb = any;

function asRecord(value: any): any {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

export function companyLabelFromProject(row: any): {
  company: string;
  companyId: string;
  website: string | null;
  industry: string | null;
} {
  const client = asRecord(row.crm_customers);
  const parent = asRecord(client?.parent);
  const companyRow =
    client?.record_kind === "contact" && parent ? parent : client;
  return {
    companyId: String(companyRow?.id || client?.id || ""),
    company:
      companyRow?.company ||
      companyRow?.name ||
      client?.company ||
      client?.name ||
      "No company",
    website: companyRow?.website || client?.website || null,
    industry: companyRow?.industry || client?.industry || null,
  };
}

export async function loadCatalogServices(supabase: Sb): Promise<CatalogServiceRow[]> {
  const { data } = await supabase
    .from("pm_services")
    .select("id, name, slug, category, short_description, full_description, sort_order")
    .order("sort_order");
  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    slug: s.slug ?? null,
    category: s.category,
    shortDescription: s.short_description ?? "",
    fullDescription: s.full_description ?? "",
    sortOrder: s.sort_order ?? 0,
  }));
}

export async function loadCatalogPackages(supabase: Sb): Promise<CatalogPackageRow[]> {
  const [{ data: pkgs }, { data: links }] = await Promise.all([
    supabase
      .from("pm_packages")
      .select(
        "id, name, slug, description, long_title, timeline_long_title, timeline_short_title, timeline_duration, timeline_description, high_level_process, sort_order"
      )
      .order("sort_order"),
    supabase.from("pm_package_services").select("package_id, service_id"),
  ]);
  const byPkg = new Map<string, string[]>();
  for (const l of links ?? []) {
    const list = byPkg.get(l.package_id) ?? [];
    list.push(l.service_id);
    byPkg.set(l.package_id, list);
  }
  return (pkgs ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug ?? null,
    description: p.description ?? "",
    longTitle: p.long_title ?? "",
    timelineLongTitle: p.timeline_long_title ?? "",
    timelineShortTitle: p.timeline_short_title ?? "",
    timelineDuration: p.timeline_duration ?? "",
    timelineDescription: p.timeline_description ?? "",
    processSteps: Array.isArray(p.high_level_process) ? p.high_level_process : [],
    serviceIds: byPkg.get(p.id) ?? [],
    sortOrder: p.sort_order ?? 0,
  }));
}

export async function loadStrategyTypeServices(
  supabase: Sb
): Promise<Record<StrategyType, string[]>> {
  const { data } = await supabase
    .from("strategy_type_services")
    .select("strategy_type, service_id, sort_order")
    .order("sort_order");
  const out = {} as Record<StrategyType, string[]>;
  for (const row of data ?? []) {
    const type = String(row.strategy_type);
    if (!isStrategyType(type)) continue;
    const list = out[type] ?? [];
    list.push(row.service_id);
    out[type] = list;
  }
  return out;
}

export async function loadStrategyTypeModuleDefaults(
  supabase: Sb
): Promise<Record<StrategyType, ModuleKey[]>> {
  const { data } = await supabase
    .from("strategy_type_module_defaults")
    .select("strategy_type, module_key, sort_order")
    .order("sort_order");
  const out = {} as Record<StrategyType, ModuleKey[]>;
  for (const row of data ?? []) {
    const type = String(row.strategy_type);
    const key = String(row.module_key);
    if (!isStrategyType(type) || !isModuleKey(key)) continue;
    const list = out[type] ?? [];
    list.push(key);
    out[type] = list;
  }
  return out;
}

export async function loadProposeProjects(
  supabase: Sb
): Promise<ProposeProjectOption[]> {
  const { data } = await supabase
    .from("projects")
    .select(
      "id, title, stage, status, bd_record_id, updated_at, crm_customers:client_id ( id, record_kind, company, name, parent:parent_company_id ( id, company, name ) )"
    )
    .order("updated_at", { ascending: false });
  return (data ?? []).map((p: any) => {
    const company = companyLabelFromProject(p);
    return {
      id: p.id,
      title: p.title || "Untitled",
      company: company.company,
      stage: p.stage ?? null,
      status: p.status ?? null,
      bdRecordId: p.bd_record_id ?? null,
    };
  });
}

export async function loadProjectForPropose(
  supabase: Sb,
  projectId: string
): Promise<{
  id: string;
  title: string;
  stage: string | null;
  status: string | null;
  bdRecordId: string | null;
  company: string;
  companyId: string;
  website: string | null;
  industry: string | null;
} | null> {
  const { data } = await supabase
    .from("projects")
    .select(
      "id, title, stage, status, bd_record_id, crm_customers:client_id ( id, record_kind, company, name, website, industry, parent:parent_company_id ( id, company, name, website, industry ) )"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  const company = companyLabelFromProject(data);
  return {
    id: data.id,
    title: data.title || "Untitled",
    stage: data.stage ?? null,
    status: data.status ?? null,
    bdRecordId: data.bd_record_id ?? null,
    company: company.company,
    companyId: company.companyId,
    website: company.website,
    industry: company.industry,
  };
}

export async function loadProjectOfferingsServiceIds(
  supabase: Sb,
  projectId: string
): Promise<{ packageId: string | null; serviceIds: string[] }> {
  const { data } = await supabase
    .from("project_offerings")
    .select("kind, catalog_id")
    .eq("project_id", projectId);
  const packages = await loadCatalogPackages(supabase);
  let packageId: string | null = null;
  const serviceIds: string[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (row.kind === "package") {
      packageId = row.catalog_id;
      const pkg = packages.find((p) => p.id === row.catalog_id);
      for (const sid of pkg?.serviceIds ?? []) {
        if (!seen.has(sid)) {
          seen.add(sid);
          serviceIds.push(sid);
        }
      }
    }
  }
  for (const row of data ?? []) {
    if (row.kind === "service" && !seen.has(row.catalog_id)) {
      seen.add(row.catalog_id);
      serviceIds.push(row.catalog_id);
    }
  }
  return { packageId, serviceIds };
}

function mapScope(row: any, items: any[], steps: any[]): ScopeRow {
  return {
    id: row.id,
    projectId: row.project_id,
    basedOnPackageId: row.based_on_package_id ?? null,
    packageName: asRecord(row.pm_packages)?.name ?? null,
    status: row.status as ScopeStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items
      .filter((i) => i.scope_id === row.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((i) => ({
        id: i.id,
        serviceId: i.service_id ?? null,
        customName: i.custom_name ?? null,
        customDescription: i.custom_description ?? null,
        sortOrder: i.sort_order ?? 0,
        serviceName: asRecord(i.pm_services)?.name ?? i.custom_name ?? null,
      })),
    steps: steps
      .filter((s) => s.scope_id === row.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((s) => ({
        id: s.id,
        sortOrder: s.sort_order,
        title: s.title,
      })),
  };
}

export async function loadScopesForProject(
  supabase: Sb,
  projectId: string
): Promise<ScopeRow[]> {
  const { data: scopes } = await supabase
    .from("scopes")
    .select(
      "id, project_id, based_on_package_id, status, created_at, updated_at, pm_packages:based_on_package_id ( name )"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const ids = (scopes ?? []).map((s: any) => s.id);
  if (!ids.length) return [];
  const [{ data: items }, { data: steps }] = await Promise.all([
    supabase
      .from("scope_items")
      .select("id, scope_id, service_id, custom_name, custom_description, sort_order, pm_services:service_id ( name )")
      .in("scope_id", ids)
      .order("sort_order"),
    supabase
      .from("scope_process_steps")
      .select("id, scope_id, sort_order, title")
      .in("scope_id", ids)
      .order("sort_order"),
  ]);
  return (scopes ?? []).map((row: any) => mapScope(row, items ?? [], steps ?? []));
}

export async function loadScope(
  supabase: Sb,
  scopeId: string
): Promise<ScopeRow | null> {
  const { data: row } = await supabase
    .from("scopes")
    .select(
      "id, project_id, based_on_package_id, status, created_at, updated_at, pm_packages:based_on_package_id ( name )"
    )
    .eq("id", scopeId)
    .maybeSingle();
  if (!row) return null;
  const [{ data: items }, { data: steps }] = await Promise.all([
    supabase
      .from("scope_items")
      .select("id, scope_id, service_id, custom_name, custom_description, sort_order, pm_services:service_id ( name )")
      .eq("scope_id", scopeId)
      .order("sort_order"),
    supabase
      .from("scope_process_steps")
      .select("id, scope_id, sort_order, title")
      .eq("scope_id", scopeId)
      .order("sort_order"),
  ]);
  return mapScope(row, items ?? [], steps ?? []);
}

function mapStrategy(row: any, modules: any[]): StrategyRow {
  return {
    id: row.id,
    scopeId: row.scope_id,
    strategyType: row.strategy_type as StrategyType,
    status: row.status as StrategyStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modules: modules
      .filter((m) => m.strategy_id === row.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((m) => ({
        id: m.id,
        moduleKey: m.module_key as ModuleKey,
        status: m.status as ModuleStatus,
        sortOrder: m.sort_order ?? 0,
      })),
  };
}

export async function loadStrategiesForScope(
  supabase: Sb,
  scopeId: string
): Promise<StrategyRow[]> {
  const { data: strategies } = await supabase
    .from("strategies")
    .select("id, scope_id, strategy_type, status, created_at, updated_at")
    .eq("scope_id", scopeId)
    .order("created_at", { ascending: false });
  const ids = (strategies ?? []).map((s: any) => s.id);
  if (!ids.length) return [];
  const { data: modules } = await supabase
    .from("strategy_modules")
    .select("id, strategy_id, module_key, status, sort_order")
    .in("strategy_id", ids)
    .order("sort_order");
  return (strategies ?? []).map((row: any) => mapStrategy(row, modules ?? []));
}

export async function loadStrategy(
  supabase: Sb,
  strategyId: string
): Promise<StrategyRow | null> {
  const { data: row } = await supabase
    .from("strategies")
    .select("id, scope_id, strategy_type, status, created_at, updated_at")
    .eq("id", strategyId)
    .maybeSingle();
  if (!row) return null;
  const { data: modules } = await supabase
    .from("strategy_modules")
    .select("id, strategy_id, module_key, status, sort_order")
    .eq("strategy_id", strategyId)
    .order("sort_order");
  return mapStrategy(row, modules ?? []);
}

export function moduleToCard(
  module: { moduleKey: ModuleKey; status: ModuleStatus },
  opts?: {
    sentimentHref?: string;
    audienceHref?: string;
    audience?: AudienceSnapshot;
    marketHref?: string;
    market?: MarketSnapshot;
    sentiment?: SentimentSnapshot;
    positioningHref?: string;
    positioning?: PositioningSnapshot;
    competitionHref?: string;
    competition?: CompetitionSnapshot;
  }
): StrategyModuleCard {
  const isAudience = module.moduleKey === AUDIENCE_MODULE_KEY;
  const isMarket = module.moduleKey === MARKET_MODULE_KEY;
  const isSentiment = module.moduleKey === SENTIMENT_MODULE_KEY;
  const isPositioning = module.moduleKey === SYNTHESIS_MODULE_KEY;
  const isCompetition = module.moduleKey === COMPETITION_MODULE_KEY;
  const href =
    isSentiment
      ? opts?.sentiment?.href || opts?.sentimentHref
      : isAudience
        ? opts?.audienceHref
        : isMarket
          ? opts?.marketHref
          : isPositioning
            ? opts?.positioningHref
            : isCompetition
              ? opts?.competitionHref
              : undefined;
  const snap = isAudience ? opts?.audience : undefined;
  const market = isMarket ? opts?.market : undefined;
  const sentiment = isSentiment ? opts?.sentiment : undefined;
  const positioning = isPositioning ? opts?.positioning : undefined;
  const competition = isCompetition ? opts?.competition : undefined;
  const summary = snap
    ? `${snap.finalizedCount} of ${snap.totalCount} segments finalized`
    : market
      ? [market.category, market.takeaway].filter(Boolean).join(" · ") ||
        MODULE_BLURBS[module.moduleKey]
      : sentiment
        ? sentiment.headline
        : positioning
          ? positioning.statement || MODULE_BLURBS[module.moduleKey]
          : competition
            ? competition.synthesisLine ||
              `${competition.totalCount} competitor${competition.totalCount === 1 ? "" : "s"}` ||
              MODULE_BLURBS[module.moduleKey]
            : MODULE_BLURBS[module.moduleKey];
  return {
    moduleKey: module.moduleKey,
    title: MODULE_LABELS[module.moduleKey],
    status: module.status,
    summary,
    href,
    finalizedCount: snap?.finalizedCount,
    totalCount: snap?.totalCount,
    segments: snap?.segments,
    categoryLabel: market?.category,
    takeaway: market?.takeaway,
    sections: market?.sections,
    sentimentHeadline: sentiment?.headline,
    positioningStatement: positioning?.statement,
    positioningRationale: positioning?.rationale,
    competitionLine: competition?.synthesisLine,
    competitionBody: competition?.synthesisBody,
    competitors: competition?.competitors,
  };
}

export function strategyTypeLabel(type: StrategyType): string {
  return STRATEGY_TYPE_LABELS[type];
}

export type LegacyDeckRow = {
  id: string;
  title: string;
  status: string;
  publicSlug: string | null;
  createdAt: string;
};

export async function loadLegacySlideDecks(supabase: Sb): Promise<LegacyDeckRow[]> {
  const { data } = await supabase
    .from("bd_slide_decks")
    .select("id, title, status, public_slug, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((d: any) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    publicSlug: d.public_slug ?? null,
    createdAt: d.created_at,
  }));
}
