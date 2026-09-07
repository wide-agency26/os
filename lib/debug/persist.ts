import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { compileDebugBrief } from "@/lib/debug/brief";
import { readViewAsCompanyId, readViewAsContactId } from "@/lib/client/view-as.server";
import type { DebugAttachment, DebugReportInput } from "@/lib/debug/types";

function text(value: unknown, max?: number): string {
  const s = typeof value === "string" ? value : "";
  const t = s.trim();
  return max ? t.slice(0, max) : t;
}

function textOrNull(value: unknown): string | null {
  const t = text(value);
  return t || null;
}

function sanitizeAttachments(raw: unknown, userId: string): DebugAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: DebugAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const path = typeof rec.path === "string" ? rec.path : "";
    const name = typeof rec.name === "string" ? rec.name : "";
    const mime = typeof rec.mime === "string" ? rec.mime : "";
    const size = typeof rec.size === "number" ? rec.size : Number(rec.size);
    if (!path.startsWith(`${userId}/`)) continue;
    if (!mime.startsWith("image/")) continue;
    if (!Number.isFinite(size) || size <= 0 || size > 5 * 1024 * 1024) continue;
    out.push({ path, name: name.slice(0, 180) || "image", mime, size });
    if (out.length >= 5) break;
  }
  return out;
}

async function viewAsLite(supabase: Awaited<ReturnType<typeof createClient>>) {
  const companyId = await readViewAsCompanyId();
  if (!companyId) {
    return {
      viewingAsClient: false,
      companyId: null as string | null,
      companyName: null as string | null,
      contactName: null as string | null,
    };
  }
  const contactId = await readViewAsContactId();
  const [{ data: company }, { data: contact }] = await Promise.all([
    supabase
      .from("crm_customers")
      .select("id, company, name")
      .eq("id", companyId)
      .maybeSingle(),
    contactId
      ? supabase.from("crm_customers").select("name").eq("id", contactId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    viewingAsClient: true,
    companyId,
    companyName: (company?.company || company?.name || "Client").trim(),
    contactName: contact?.name?.trim() || null,
  };
}

function writerClient(userClient: Awaited<ReturnType<typeof createClient>>) {
  try {
    return createAdminClient();
  } catch (e) {
    console.error("[debug-report] admin client", e);
    return userClient;
  }
}

/** Persist a founder debug report. Never throws — failures return { ok: false }. */
export async function persistDebugReport(
  input: DebugReportInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || !isFounder(profile.role)) {
      return { ok: false, error: "Founders only" };
    }

    const what = text(input.whatHappened);
    if (!what) return { ok: false, error: "Say what went wrong." };

    const title =
      text(input.title, 180) ||
      text(input.snapshot?.heading, 180) ||
      "Untitled issue";

    const preview = await viewAsLite(supabase);
    const email = user.email || "";
    const reporterName = profile.full_name || "Founder";
    const reporterRole = profile.role || "superadmin";

    const agentBrief = compileDebugBrief(
      { ...input, title, whatHappened: what },
      {
        reporterName,
        reporterEmail: email,
        reporterRole,
        viewingAsClient: preview.viewingAsClient,
        viewAsCompanyName: preview.companyName,
        viewAsContactName: preview.contactName,
      }
    );

    const snap = input.snapshot;
    const payload = {
      reporter_id: user.id,
      reporter_name: reporterName,
      reporter_email: email || null,
      reporter_role: reporterRole,
      status: "open",
      severity: input.severity || "medium",
      report_type:
        input.reportType === "enhancement" ? "enhancement" : "bug",
      title,
      what_happened: what,
      expected: textOrNull(input.expected),
      actual: textOrNull(input.actual),
      before_experience: textOrNull(input.beforeExperience),
      after_experience: textOrNull(input.afterExperience),
      repro_steps: textOrNull(input.reproSteps),
      project_id: input.projectId || null,
      href: snap?.href ?? null,
      pathname: snap?.pathname ?? null,
      search: snap?.search ?? null,
      hash: snap?.hash ?? null,
      page_title: snap?.pageTitle ?? null,
      tab_label: snap?.selectedTab ?? null,
      location_label: snap?.locationLabel ?? null,
      view_as_company_id: preview.companyId,
      view_as_company_name: preview.companyName,
      view_as_contact_name: preview.contactName,
      viewing_as_client: preview.viewingAsClient,
      context: snap && typeof snap === "object" ? snap : {},
      agent_brief: agentBrief,
      attachments: sanitizeAttachments(input.attachments, user.id),
    };

    const writer = writerClient(supabase) as ReturnType<typeof createAdminClient>;
    const { data, error } = await writer
      .from("debug_reports")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("[debug-report] insert", error?.message);
      return { ok: false, error: error?.message || "Could not save the report." };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[debug-report] persist", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save the report.",
    };
  }
}
