"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveExecutiveAccess } from "@/lib/wide-os/resolve-access";
import {
  loadPendingCompanyAccess,
  type CompanyMemberRow,
} from "@/app/actions/company-members";
import { loadPendingDeals } from "@/lib/bd/deal-finder/rows";

export type FounderNotificationRow = {
  id: string;
  workspace_id: string | null;
  title: string;
  message: string;
  severity_level: "Info" | "Success" | "Warning" | "Critical";
  created_at: string;
  link: string | null;
  meta: Record<string, unknown>;
};

export type InboxItem = {
  id: string;
  kind: "company_access" | "notice" | "deal_finder";
  title: string;
  message: string;
  href: string;
  createdAt: string;
  severity: FounderNotificationRow["severity_level"];
  member?: CompanyMemberRow;
};

function asMeta(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function listFounderNotifications(): Promise<{
  notifications: FounderNotificationRow[];
  error?: string;
}> {
  const access = await resolveExecutiveAccess();
  if (!access.executive) return { notifications: [], error: "Founder access required." };

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    return { notifications: [], error: e instanceof Error ? e.message : "Admin client missing." };
  }
  const { data, error } = await supabase
    .from("founder_notifications")
    .select("id, workspace_id, title, message, severity_level, created_at, link, meta")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    if (error.code === "42P01") return { notifications: [] };
    return { notifications: [], error: error.message };
  }

  return {
    notifications: (data ?? []).map((row) => ({
      ...(row as FounderNotificationRow),
      meta: asMeta(row.meta),
      link: row.link ?? null,
    })),
  };
}

/** Unified inbox: live pending portal requests + other unread founder notices. */
export async function listFounderInbox(): Promise<{
  items: InboxItem[];
  pendingAccess: CompanyMemberRow[];
  error?: string;
}> {
  const access = await resolveExecutiveAccess();
  if (!access.executive) {
    return { items: [], pendingAccess: [], error: "Founder access required." };
  }

  const pendingAccess = await loadPendingCompanyAccess();
  const { notifications, error } = await listFounderNotifications();
  if (error) return { items: [], pendingAccess, error };

  let pendingDeals: Awaited<ReturnType<typeof loadPendingDeals>> = [];
  try {
    pendingDeals = await loadPendingDeals(createAdminClient());
  } catch {
    pendingDeals = [];
  }

  const pendingIds = new Set(pendingAccess.map((m) => m.id));
  const accessItems: InboxItem[] = pendingAccess.map((member) => ({
    id: `access:${member.id}`,
    kind: "company_access",
    title: "Portal access request",
    message: `${member.user_name} (${member.user_email}) requested access to ${member.company_name}`,
    href: "/app/crm/access",
    createdAt: member.requested_at,
    severity: "Warning",
    member,
  }));

  const dealItems: InboxItem[] = pendingDeals.map((deal) => ({
    id: `deal:${deal.id}`,
    kind: "deal_finder" as const,
    title: deal.companyName,
    message: deal.signalSummary,
    href: "/app/home#deal-finder",
    createdAt: deal.runAt,
    severity: "Info",
  }));

  const noticeItems: InboxItem[] = notifications
    .filter((n) => {
      if (n.meta.kind === "deal_finder") return false;
      if (n.meta.kind !== "company_access") return true;
      const memberId = String(n.meta.member_id || "");
      return memberId ? !pendingIds.has(memberId) : true;
    })
    .map((n) => ({
      id: n.id,
      kind: "notice" as const,
      title: n.title,
      message: n.message,
      href: n.link || "/app/home",
      createdAt: n.created_at,
      severity: n.severity_level,
    }));

  const items = [...accessItems, ...dealItems, ...noticeItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { items, pendingAccess };
}

export async function resolveFounderNotification(notificationId: string): Promise<{ error?: string }> {
  const access = await resolveExecutiveAccess();
  if (!access.executive) return { error: "Founder access required." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("founder_notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    if (error.code === "42P01") return { error: "Notification center not migrated yet." };
    return { error: error.message };
  }

  revalidatePath("/app/home");
  revalidatePath("/app/crm/access");
  return {};
}

export async function createFounderNotification(input: {
  title: string;
  message: string;
  severity_level?: FounderNotificationRow["severity_level"];
  workspace_id?: string | null;
  link?: string | null;
  meta?: Record<string, unknown>;
}): Promise<{ error?: string }> {
  const access = await resolveExecutiveAccess();
  if (!access.executive) return { error: "Founder access required." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("founder_notifications").insert({
    title: input.title,
    message: input.message,
    severity_level: input.severity_level ?? "Info",
    workspace_id: input.workspace_id ?? null,
    link: input.link ?? null,
    meta: input.meta ?? {},
  });

  if (error) return { error: error.message };
  revalidatePath("/app/home");
  return {};
}
