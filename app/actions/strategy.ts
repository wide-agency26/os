"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { workPaths } from "@/lib/work/paths";
import {
  AUDIENCE_MODULE_KEY,
  COMPETITION_MODULE_KEY,
  MARKET_MODULE_KEY,
  SENTIMENT_MODULE_KEY,
  SYNTHESIS_MODULE_KEY,
  STRATEGY_TYPE_MODULE_DEFAULTS,
  STRATEGY_TYPE_SERVICE_NAMES,
  isModuleKey,
  isStrategyType,
  type ModuleKey,
  type ModuleStatus,
  type ScopeStatus,
  type StrategyType,
} from "@/lib/strategy/modules";
import {
  loadCatalogPackages,
  loadCatalogServices,
  loadLegacySlideDecks,
  loadProjectForPropose,
  loadProjectOfferingsServiceIds,
  loadProposeProjects,
  loadScope,
  loadScopesForProject,
  loadStrategiesForScope,
  loadStrategy,
  loadStrategyTypeModuleDefaults,
  loadStrategyTypeServices,
  type LegacyDeckRow,
} from "@/lib/strategy/load";
import type {
  CatalogPackageRow,
  CatalogServiceRow,
  ProposeProjectOption,
  ScopeRow,
  StrategyRow,
} from "@/lib/strategy/types";

async function requireFounder() {
  const supabase = (await createClient()) as any;
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
    return { supabase, user: null, error: "Only founders can manage strategy" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateStrategy(opts?: {
  projectId?: string;
  scopeId?: string;
  strategyId?: string;
  catalog?: boolean;
}) {
  if (opts?.catalog) {
    revalidatePath(workPaths.playbooks);
    revalidatePath(workPaths.playbooksStrategy);
    return;
  }
  revalidatePath(workPaths.propose);
  if (opts?.projectId) {
    revalidatePath(workPaths.proposeProject(opts.projectId));
    revalidatePath(workPaths.proposeAudience(opts.projectId));
    revalidatePath(workPaths.proposeMarket(opts.projectId));
    revalidatePath(workPaths.proposeCompetition(opts.projectId));
    if (opts.scopeId) {
      revalidatePath(workPaths.proposeScope(opts.projectId, opts.scopeId));
      if (opts.strategyId) {
        revalidatePath(
          workPaths.proposeBuilder(opts.projectId, opts.scopeId, opts.strategyId)
        );
        revalidatePath(
          workPaths.proposeContext(opts.projectId, opts.scopeId, opts.strategyId)
        );
        revalidatePath(
          workPaths.proposeTheme(opts.projectId, opts.scopeId, opts.strategyId)
        );
        revalidatePath(
          workPaths.proposeShare(opts.projectId, opts.scopeId, opts.strategyId)
        );
        revalidatePath(
          workPaths.proposePositioning(opts.projectId, opts.scopeId, opts.strategyId)
        );
      }
    }
  }
}

export async function listStrategyCatalog(): Promise<{
  ok: boolean;
  error?: string;
  services: CatalogServiceRow[];
  packages: CatalogPackageRow[];
  typeServices: Record<string, string[]>;
  typeModules: Record<string, ModuleKey[]>;
}> {
  const { supabase, error } = await requireFounder();
  if (error) {
    return { ok: false, error, services: [], packages: [], typeServices: {}, typeModules: {} };
  }
  const [services, packages, typeServices, typeModules] = await Promise.all([
    loadCatalogServices(supabase),
    loadCatalogPackages(supabase),
    loadStrategyTypeServices(supabase),
    loadStrategyTypeModuleDefaults(supabase),
  ]);
  return { ok: true, services, packages, typeServices, typeModules };
}

export async function updateServiceCopy(input: {
  id: string;
  shortDescription: string;
  fullDescription: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: upd } = await supabase
    .from("pm_services")
    .update({
      short_description: input.shortDescription,
      full_description: input.fullDescription,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (upd) return { ok: false, error: upd.message };
  revalidateStrategy({ catalog: true });
  return { ok: true };
}

export async function updatePackageCopy(input: {
  id: string;
  description: string;
  longTitle: string;
  timelineLongTitle: string;
  timelineShortTitle: string;
  timelineDuration: string;
  timelineDescription: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: upd } = await supabase
    .from("pm_packages")
    .update({
      description: input.description,
      long_title: input.longTitle,
      timeline_long_title: input.timelineLongTitle,
      timeline_short_title: input.timelineShortTitle,
      timeline_duration: input.timelineDuration,
      timeline_description: input.timelineDescription,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (upd) return { ok: false, error: upd.message };
  revalidateStrategy({ catalog: true });
  return { ok: true };
}

export async function saveStrategyTypeServices(input: {
  strategyType: string;
  serviceIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!isStrategyType(input.strategyType)) return { ok: false, error: "Unknown type" };
  await supabase
    .from("strategy_type_services")
    .delete()
    .eq("strategy_type", input.strategyType);
  if (input.serviceIds.length) {
    const { error: ins } = await supabase.from("strategy_type_services").insert(
      input.serviceIds.map((service_id, i) => ({
        strategy_type: input.strategyType,
        service_id,
        sort_order: i + 1,
      }))
    );
    if (ins) return { ok: false, error: ins.message };
  }
  revalidateStrategy({ catalog: true });
  return { ok: true };
}

export async function saveStrategyTypeModules(input: {
  strategyType: string;
  moduleKeys: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!isStrategyType(input.strategyType)) return { ok: false, error: "Unknown type" };
  const keys = input.moduleKeys.filter(isModuleKey);
  await supabase
    .from("strategy_type_module_defaults")
    .delete()
    .eq("strategy_type", input.strategyType);
  if (keys.length) {
    const { error: ins } = await supabase.from("strategy_type_module_defaults").insert(
      keys.map((module_key, i) => ({
        strategy_type: input.strategyType,
        module_key,
        sort_order: i + 1,
      }))
    );
    if (ins) return { ok: false, error: ins.message };
  }
  revalidateStrategy({ catalog: true });
  return { ok: true };
}

export async function resetStrategyDefaults(): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  await supabase.from("strategy_type_module_defaults").delete().neq("strategy_type", "");
  await supabase.from("strategy_type_services").delete().neq("strategy_type", "");

  const { error: defErr } = await supabase.from("strategy_type_module_defaults").insert(
    STRATEGY_TYPE_MODULE_DEFAULTS.map((row) => ({
      strategy_type: row.strategyType,
      module_key: row.moduleKey,
      sort_order: row.sortOrder,
    }))
  );
  if (defErr) return { ok: false, error: defErr.message };

  const { data: services } = await supabase.from("pm_services").select("id, name");
  const byName = new Map((services ?? []).map((s: { id: string; name: string }) => [s.name, s.id]));
  const mapRows: { strategy_type: string; service_id: string; sort_order: number }[] = [];
  for (const [type, names] of Object.entries(STRATEGY_TYPE_SERVICE_NAMES)) {
    names.forEach((name, i) => {
      const id = byName.get(name) as string | undefined;
      if (id) {
        mapRows.push({ strategy_type: type, service_id: id, sort_order: i + 1 });
      }
    });
  }
  if (mapRows.length) {
    const { error: mapErr } = await supabase.from("strategy_type_services").insert(mapRows);
    if (mapErr) return { ok: false, error: mapErr.message };
  }

  revalidateStrategy({ catalog: true });
  return { ok: true };
}

export async function listProposeHub(): Promise<{
  ok: boolean;
  error?: string;
  projects: ProposeProjectOption[];
  decks: LegacyDeckRow[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error, projects: [], decks: [] };
  const [projects, decks] = await Promise.all([
    loadProposeProjects(supabase),
    loadLegacySlideDecks(supabase),
  ]);
  return { ok: true, projects, decks };
}

export async function resolveProjectForBd(
  bdRecordId: string
): Promise<{ ok: boolean; projectId?: string | null; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("bd_record_id", bdRecordId)
    .limit(1)
    .maybeSingle();
  return { ok: true, projectId: data?.id ?? null };
}

export async function listProjectScopes(projectId: string): Promise<{
  ok: boolean;
  error?: string;
  project: Awaited<ReturnType<typeof loadProjectForPropose>>;
  scopes: ScopeRow[];
  packages: CatalogPackageRow[];
  services: CatalogServiceRow[];
  prefill: { packageId: string | null; serviceIds: string[] };
}> {
  const empty = {
    ok: false as const,
    project: null,
    scopes: [] as ScopeRow[],
    packages: [] as CatalogPackageRow[],
    services: [] as CatalogServiceRow[],
    prefill: { packageId: null as string | null, serviceIds: [] as string[] },
  };
  const { supabase, error } = await requireFounder();
  if (error) return { ...empty, error };
  const [project, scopes, packages, services, prefill] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadScopesForProject(supabase, projectId),
    loadCatalogPackages(supabase),
    loadCatalogServices(supabase),
    loadProjectOfferingsServiceIds(supabase, projectId),
  ]);
  if (!project) return { ...empty, error: "Project not found" };
  return { ok: true, project, scopes, packages, services, prefill };
}

export async function createScopeFromPackage(input: {
  projectId: string;
  packageId: string;
}): Promise<{ ok: boolean; error?: string; scopeId?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const packages = await loadCatalogPackages(supabase);
  const pkg = packages.find((p) => p.id === input.packageId);
  if (!pkg) return { ok: false, error: "Package not found" };

  const { data: scope, error: ins } = await supabase
    .from("scopes")
    .insert({
      project_id: input.projectId,
      based_on_package_id: input.packageId,
      status: "draft",
    })
    .select("id")
    .single();
  if (ins || !scope) return { ok: false, error: ins?.message || "Could not create scope" };

  if (pkg.serviceIds.length) {
    const { error: itemErr } = await supabase.from("scope_items").insert(
      pkg.serviceIds.map((service_id, i) => ({
        scope_id: scope.id,
        service_id,
        sort_order: i + 1,
      }))
    );
    if (itemErr) return { ok: false, error: itemErr.message };
  }
  if (pkg.processSteps.length) {
    const { error: stepErr } = await supabase.from("scope_process_steps").insert(
      pkg.processSteps.map((title, i) => ({
        scope_id: scope.id,
        sort_order: i + 1,
        title,
      }))
    );
    if (stepErr) return { ok: false, error: stepErr.message };
  }

  revalidateStrategy({ projectId: input.projectId, scopeId: scope.id });
  return { ok: true, scopeId: scope.id };
}

export async function createScopeALaCarte(input: {
  projectId: string;
  serviceIds: string[];
  customItems?: { name: string; description?: string }[];
}): Promise<{ ok: boolean; error?: string; scopeId?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  let serviceIds = input.serviceIds;
  if (!serviceIds.length && !input.customItems?.length) {
    const prefill = await loadProjectOfferingsServiceIds(supabase, input.projectId);
    serviceIds = prefill.serviceIds;
  }

  const { data: scope, error: ins } = await supabase
    .from("scopes")
    .insert({
      project_id: input.projectId,
      based_on_package_id: null,
      status: "draft",
    })
    .select("id")
    .single();
  if (ins || !scope) return { ok: false, error: ins?.message || "Could not create scope" };

  const rows: {
    scope_id: string;
    service_id: string | null;
    custom_name?: string;
    custom_description?: string;
    sort_order: number;
  }[] = serviceIds.map((service_id, i) => ({
    scope_id: scope.id,
    service_id,
    sort_order: i + 1,
  }));
  (input.customItems ?? []).forEach((item, i) => {
    if (!item.name.trim()) return;
    rows.push({
      scope_id: scope.id,
      service_id: null,
      custom_name: item.name.trim(),
      custom_description: item.description?.trim() || undefined,
      sort_order: rows.length + i + 1,
    });
  });
  if (rows.length) {
    const { error: itemErr } = await supabase.from("scope_items").insert(rows);
    if (itemErr) return { ok: false, error: itemErr.message };
  }

  revalidateStrategy({ projectId: input.projectId, scopeId: scope.id });
  return { ok: true, scopeId: scope.id };
}

export async function updateScopeStatus(input: {
  scopeId: string;
  projectId: string;
  status: ScopeStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: upd } = await supabase
    .from("scopes")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.scopeId);
  if (upd) return { ok: false, error: upd.message };
  revalidateStrategy({ projectId: input.projectId, scopeId: input.scopeId });
  return { ok: true };
}

export async function reorderScopeItems(input: {
  projectId: string;
  scopeId: string;
  orderedIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error: upd } = await supabase
      .from("scope_items")
      .update({ sort_order: i + 1 })
      .eq("id", input.orderedIds[i])
      .eq("scope_id", input.scopeId);
    if (upd) return { ok: false, error: upd.message };
  }
  revalidateStrategy({ projectId: input.projectId, scopeId: input.scopeId });
  return { ok: true };
}

export async function addScopeItem(input: {
  projectId: string;
  scopeId: string;
  serviceId?: string | null;
  customName?: string;
  customDescription?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { data: last } = await supabase
    .from("scope_items")
    .select("sort_order")
    .eq("scope_id", input.scopeId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: ins } = await supabase.from("scope_items").insert({
    scope_id: input.scopeId,
    service_id: input.serviceId || null,
    custom_name: input.customName?.trim() || null,
    custom_description: input.customDescription?.trim() || null,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (ins) return { ok: false, error: ins.message };
  revalidateStrategy({ projectId: input.projectId, scopeId: input.scopeId });
  return { ok: true };
}

export async function removeScopeItem(input: {
  projectId: string;
  scopeId: string;
  itemId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: del } = await supabase
    .from("scope_items")
    .delete()
    .eq("id", input.itemId)
    .eq("scope_id", input.scopeId);
  if (del) return { ok: false, error: del.message };
  revalidateStrategy({ projectId: input.projectId, scopeId: input.scopeId });
  return { ok: true };
}

export async function deleteScope(input: {
  projectId: string;
  scopeId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: del } = await supabase.from("scopes").delete().eq("id", input.scopeId);
  if (del) return { ok: false, error: del.message };
  revalidateStrategy({ projectId: input.projectId });
  return { ok: true };
}

export async function listScopeStrategies(input: {
  projectId: string;
  scopeId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  project: Awaited<ReturnType<typeof loadProjectForPropose>>;
  scope: ScopeRow | null;
  strategies: StrategyRow[];
  typeServices: Record<string, string[]>;
  services: CatalogServiceRow[];
}> {
  const empty = {
    ok: false as const,
    project: null,
    scope: null as ScopeRow | null,
    strategies: [] as StrategyRow[],
    typeServices: {} as Record<string, string[]>,
    services: [] as CatalogServiceRow[],
  };
  const { supabase, error } = await requireFounder();
  if (error) return { ...empty, error };
  const [project, scope, strategies, typeServices, services] = await Promise.all([
    loadProjectForPropose(supabase, input.projectId),
    loadScope(supabase, input.scopeId),
    loadStrategiesForScope(supabase, input.scopeId),
    loadStrategyTypeServices(supabase),
    loadCatalogServices(supabase),
  ]);
  if (!project || !scope || scope.projectId !== input.projectId) {
    return { ...empty, error: "Scope not found" };
  }
  return { ok: true, project, scope, strategies, typeServices, services };
}

export async function createStrategy(input: {
  projectId: string;
  scopeId: string;
  strategyType: string;
}): Promise<{ ok: boolean; error?: string; strategyId?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!isStrategyType(input.strategyType)) return { ok: false, error: "Unknown type" };

  const { data: strategy, error: ins } = await supabase
    .from("strategies")
    .insert({
      scope_id: input.scopeId,
      strategy_type: input.strategyType,
      status: "draft",
    })
    .select("id")
    .single();
  if (ins || !strategy) return { ok: false, error: ins?.message || "Could not create" };

  const defaults = await loadStrategyTypeModuleDefaults(supabase);
  const keys = defaults[input.strategyType as StrategyType] ?? [];
  if (keys.length) {
    const { error: modErr } = await supabase.from("strategy_modules").insert(
      keys.map((module_key, i) => ({
        strategy_id: strategy.id,
        module_key,
        status: "not_started",
        sort_order: i + 1,
      }))
    );
    if (modErr) return { ok: false, error: modErr.message };
  }
  if (keys.includes(AUDIENCE_MODULE_KEY)) {
    const { syncAudienceModuleStatus } = await import("@/lib/audience/sync");
    await syncAudienceModuleStatus(supabase, input.projectId);
  }
  if (keys.includes(COMPETITION_MODULE_KEY)) {
    const { syncCompetitionModuleStatus } = await import("@/lib/competition/sync");
    await syncCompetitionModuleStatus(supabase, input.projectId);
  }
  if (keys.includes(MARKET_MODULE_KEY)) {
    const { syncMarketModuleStatus } = await import("@/lib/market/sync");
    await syncMarketModuleStatus(supabase, input.projectId);
  }
  if (keys.includes(SENTIMENT_MODULE_KEY)) {
    const { syncSentimentModuleStatus } = await import("@/lib/sentiment/sync");
    await syncSentimentModuleStatus(supabase, input.projectId);
  }
  if (keys.includes(SYNTHESIS_MODULE_KEY)) {
    const { syncPositioningModuleStatus } = await import("@/lib/positioning/sync");
    await syncPositioningModuleStatus(supabase, strategy.id);
  }

  revalidateStrategy({
    projectId: input.projectId,
    scopeId: input.scopeId,
    strategyId: strategy.id,
  });
  return { ok: true, strategyId: strategy.id };
}

export async function addStrategyModule(input: {
  projectId: string;
  scopeId: string;
  strategyId: string;
  moduleKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!isModuleKey(input.moduleKey)) return { ok: false, error: "Unknown module" };
  const { data: last } = await supabase
    .from("strategy_modules")
    .select("sort_order")
    .eq("strategy_id", input.strategyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: ins } = await supabase.from("strategy_modules").insert({
    strategy_id: input.strategyId,
    module_key: input.moduleKey,
    status: "not_started",
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (ins) {
    if (ins.code === "23505") return { ok: false, error: "That module is already on this strategy" };
    return { ok: false, error: ins.message };
  }
  if (input.moduleKey === AUDIENCE_MODULE_KEY) {
    const { syncAudienceModuleStatus } = await import("@/lib/audience/sync");
    await syncAudienceModuleStatus(supabase, input.projectId);
  }
  if (input.moduleKey === COMPETITION_MODULE_KEY) {
    const { syncCompetitionModuleStatus } = await import("@/lib/competition/sync");
    await syncCompetitionModuleStatus(supabase, input.projectId);
  }
  if (input.moduleKey === MARKET_MODULE_KEY) {
    const { syncMarketModuleStatus } = await import("@/lib/market/sync");
    await syncMarketModuleStatus(supabase, input.projectId);
  }
  if (input.moduleKey === SENTIMENT_MODULE_KEY) {
    const { syncSentimentModuleStatus } = await import("@/lib/sentiment/sync");
    await syncSentimentModuleStatus(supabase, input.projectId);
  }
  if (input.moduleKey === SYNTHESIS_MODULE_KEY) {
    const { syncPositioningModuleStatus } = await import("@/lib/positioning/sync");
    await syncPositioningModuleStatus(supabase, input.strategyId);
  }
  revalidateStrategy(input);
  return { ok: true };
}

export async function removeStrategyModule(input: {
  projectId: string;
  scopeId: string;
  strategyId: string;
  moduleId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: del } = await supabase
    .from("strategy_modules")
    .delete()
    .eq("id", input.moduleId)
    .eq("strategy_id", input.strategyId);
  if (del) return { ok: false, error: del.message };
  revalidateStrategy(input);
  return { ok: true };
}

export async function setStrategyModuleStatus(input: {
  projectId: string;
  scopeId: string;
  strategyId: string;
  moduleId: string;
  status: ModuleStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { data: row } = await supabase
    .from("strategy_modules")
    .select("module_key")
    .eq("id", input.moduleId)
    .maybeSingle();
  if (row?.module_key === AUDIENCE_MODULE_KEY) {
    const { syncAudienceModuleStatus } = await import("@/lib/audience/sync");
    await syncAudienceModuleStatus(supabase, input.projectId);
    revalidateStrategy(input);
    return { ok: true };
  }
  if (row?.module_key === COMPETITION_MODULE_KEY) {
    const { syncCompetitionModuleStatus } = await import("@/lib/competition/sync");
    await syncCompetitionModuleStatus(supabase, input.projectId);
    revalidateStrategy(input);
    return { ok: true };
  }
  if (row?.module_key === MARKET_MODULE_KEY) {
    const { syncMarketModuleStatus } = await import("@/lib/market/sync");
    await syncMarketModuleStatus(supabase, input.projectId);
    revalidateStrategy(input);
    return { ok: true };
  }
  if (row?.module_key === SENTIMENT_MODULE_KEY) {
    const { syncSentimentModuleStatus } = await import("@/lib/sentiment/sync");
    await syncSentimentModuleStatus(supabase, input.projectId);
    revalidateStrategy(input);
    return { ok: true };
  }
  if (row?.module_key === SYNTHESIS_MODULE_KEY) {
    const { syncPositioningModuleStatus } = await import("@/lib/positioning/sync");
    await syncPositioningModuleStatus(supabase, input.strategyId);
    revalidateStrategy(input);
    return { ok: true };
  }
  const { error: upd } = await supabase
    .from("strategy_modules")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.moduleId)
    .eq("strategy_id", input.strategyId);
  if (upd) return { ok: false, error: upd.message };

  const strategy = await loadStrategy(supabase, input.strategyId);
  if (strategy) {
    const allFinal = strategy.modules.every((m) => m.status === "finalized");
    const anyStarted = strategy.modules.some((m) => m.status !== "not_started");
    const next = allFinal && strategy.modules.length ? "finalized" : anyStarted ? "in_progress" : "draft";
    await supabase
      .from("strategies")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", input.strategyId);
  }

  revalidateStrategy(input);
  return { ok: true };
}

export async function deleteStrategy(input: {
  projectId: string;
  scopeId: string;
  strategyId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: del } = await supabase.from("strategies").delete().eq("id", input.strategyId);
  if (del) return { ok: false, error: del.message };
  revalidateStrategy({ projectId: input.projectId, scopeId: input.scopeId });
  return { ok: true };
}
