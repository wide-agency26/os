"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { DEFAULT_RUN_OPTIONS, MAX_PAGES_LIMIT } from "@/lib/seo/constants";
import { kickWorker } from "@/lib/seo/kick";
import { getRunProgress } from "@/lib/seo/load-run";
import { domainOf, normalizeSiteUrl, slugifySeoPart } from "@/lib/seo/url";
import type { SeoRunOptions } from "@/lib/seo/types";
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
    return { supabase, user: null, error: "Founders only" };
  }
  return { supabase, user, error: null as string | null };
}

function sanitizeOptions(input: Partial<SeoRunOptions> | undefined): SeoRunOptions {
  const raw = input ?? {};
  const competitors = (raw.competitors ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((c) => {
      try {
        return normalizeSiteUrl(c);
      } catch {
        return null;
      }
    })
    .filter((c): c is string => Boolean(c));

  return {
    ...DEFAULT_RUN_OPTIONS,
    ...raw,
    maxPages: Math.max(
      1,
      Math.min(raw.maxPages ?? DEFAULT_RUN_OPTIONS.maxPages, MAX_PAGES_LIMIT)
    ),
    maxDepth: Math.max(1, Math.min(raw.maxDepth ?? DEFAULT_RUN_OPTIONS.maxDepth, 10)),
    perfSampleSize: Math.max(
      1,
      Math.min(raw.perfSampleSize ?? DEFAULT_RUN_OPTIONS.perfSampleSize, 25)
    ),
    competitorMaxPages: Math.max(
      5,
      Math.min(raw.competitorMaxPages ?? DEFAULT_RUN_OPTIONS.competitorMaxPages, 200)
    ),
    competitors,
  };
}

export async function startSeoRun(input: {
  url: string;
  options?: Partial<SeoRunOptions>;
  siteId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  bdRecordId?: string | null;
  gscProperty?: string | null;
}): Promise<{ ok: boolean; error?: string; runId?: string; slug?: string }> {
  const { user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  let normalized: string;
  try {
    normalized = normalizeSiteUrl(input.url);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid URL" };
  }

  const domain = domainOf(normalized);
  const admin = createAdminClient();

  // One site row per domain; runs accumulate against it so we can show trends.
  let siteId = input.siteId ?? null;
  if (!siteId) {
    const { data: existing } = await admin
      .from("seo_sites")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      siteId = (existing as { id: string }).id;
      const patch: Record<string, unknown> = { url: normalized, updated_at: new Date().toISOString() };
      if (input.companyId) patch.company_id = input.companyId;
      if (input.projectId) patch.project_id = input.projectId;
      if (input.bdRecordId) patch.bd_record_id = input.bdRecordId;
      if (input.gscProperty !== undefined) patch.gsc_property = input.gscProperty;
      await admin.from("seo_sites").update(patch).eq("id", siteId);
    } else {
      const { data: created, error: siteErr } = await admin
        .from("seo_sites")
        .insert({
          domain,
          url: normalized,
          label: domain,
          company_id: input.companyId ?? null,
          project_id: input.projectId ?? null,
          bd_record_id: input.bdRecordId ?? null,
          gsc_property: input.gscProperty ?? null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (siteErr || !created) {
        return { ok: false, error: siteErr?.message ?? "Could not create site" };
      }
      siteId = (created as { id: string }).id;
    }
  }

  const options = sanitizeOptions(input.options);
  const slug = `${slugifySeoPart(domain)}-${Date.now().toString(36).slice(-6)}`;

  const { data: run, error: runErr } = await admin
    .from("seo_runs")
    .insert({
      site_id: siteId,
      public_slug: slug,
      status: "queued",
      phase: "discover",
      options: options as unknown as Json,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (runErr || !run) {
    return { ok: false, error: runErr?.message ?? "Could not queue the audit" };
  }

  const runId = (run as { id: string }).id;

  await admin.from("seo_run_events").insert({
    run_id: runId,
    phase: "discover",
    level: "info",
    message: `Audit queued for ${domain}`,
    meta: { max_pages: options.maxPages } as Json,
  });

  // Hand off after the response is sent so the user is not left waiting.
  after(() => kickWorker(runId));

  revalidatePath("/app/seo");
  return { ok: true, runId, slug };
}

export async function cancelSeoRun(
  runId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };

  const admin = createAdminClient();
  await admin
    .from("seo_runs")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["queued", "running"]);

  revalidatePath("/app/seo");
  revalidatePath(`/app/seo/${runId}`);
  return { ok: true };
}

export async function retrySeoRun(
  runId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };

  const admin = createAdminClient();
  await admin
    .from("seo_runs")
    .update({
      status: "queued",
      attempt: 0,
      error_message: null,
      heartbeat_at: null,
      finished_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  after(() => kickWorker(runId));
  revalidatePath(`/app/seo/${runId}`);
  return { ok: true };
}

/** Poll target for the live run view. Kept small — it fires every few seconds. */
export async function pollSeoRun(runId: string) {
  const { error } = await requireFounder();
  if (error) return null;

  const progress = await getRunProgress(runId);

  // The sweeper cron only runs once a day on this plan, so an open run view
  // doubles as a watchdog: if the worker died mid-slice, restart it here.
  if (progress?.stalled) after(() => kickWorker(runId));

  return progress;
}

export async function updateSeoSite(input: {
  siteId: string;
  label?: string | null;
  gscProperty?: string | null;
  isClientVisible?: boolean;
  monthlyRerun?: boolean;
  companyId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.label !== undefined) patch.label = input.label;
  if (input.gscProperty !== undefined) patch.gsc_property = input.gscProperty;
  if (input.isClientVisible !== undefined) patch.is_client_visible = input.isClientVisible;
  if (input.monthlyRerun !== undefined) patch.monthly_rerun = input.monthlyRerun;
  if (input.companyId !== undefined) patch.company_id = input.companyId;

  const admin = createAdminClient();
  const { error: updErr } = await admin.from("seo_sites").update(patch).eq("id", input.siteId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/app/seo");
  return { ok: true };
}
